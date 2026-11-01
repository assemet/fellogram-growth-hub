-- Bot notifications: the customer opts in; the server sends stamp/reward messages and the owner can
-- remind inactive customers. Safe to run more than once.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language_code text;

-- What was sent to whom: lets the server avoid spamming (at most one reminder per customer every 14 days,
-- no stamp message within 2 minutes of another). Written and read by the backend only.
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS notification_log_kind_check;
ALTER TABLE public.notification_log ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('stamp', 'near_reward', 'reward_ready', 'reminder'));

CREATE INDEX IF NOT EXISTS notification_log_customer_idx
  ON public.notification_log (store_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_kind_idx
  ON public.notification_log (store_id, kind, created_at DESC);

-- No policies on purpose: with RLS on, app users (anon/authenticated) can neither read nor write it.
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_log FROM anon, authenticated;
GRANT ALL ON public.notification_log TO service_role;

NOTIFY pgrst, 'reload schema';
