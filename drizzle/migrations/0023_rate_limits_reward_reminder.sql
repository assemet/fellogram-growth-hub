-- 1) Request rate limits: fixed-window counters kept by the server (service role only).
--    The app server calls rate_limit_hit() before sensitive actions; it returns false once a caller
--    has used up its allowance for the window.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(_bucket text, _subject text, _max integer, _window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _hits integer;
BEGIN
  INSERT INTO public.rate_limits AS r (bucket, subject, window_start, hits)
  VALUES (_bucket, _subject, now(), 1)
  ON CONFLICT (bucket, subject) DO UPDATE
    SET window_start = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE r.window_start END,
        hits = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE r.hits + 1 END
  RETURNING r.hits INTO _hits;

  -- Housekeeping: now and then drop counters that have been idle for a day.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN _hits <= _max;
END;
$function$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;

-- 2) Reminder for rewards nobody collected: a new kind in the notification log.
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS notification_log_kind_check;
ALTER TABLE public.notification_log ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('stamp', 'near_reward', 'reward_ready', 'reminder', 'reward_reminder'));

NOTIFY pgrst, 'reload schema';
