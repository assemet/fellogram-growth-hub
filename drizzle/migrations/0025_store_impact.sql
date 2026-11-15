-- "What did Fellogram bring back?" for the store owner: three honest numbers for the last N days, each with the
-- previous period for comparison. Counts only; no customer is named. Safe to run more than once.
--   returning : customers who visited at least twice in the period
--   wonBack   : customers who came back (a stamp) within 7 days of a reminder we sent them in the period
--   rewards / offersUsed : what actually left the store
-- Undone stamps never count.
CREATE OR REPLACE FUNCTION public.store_impact(_store_id uuid, _days integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _span integer := LEAST(90, GREATEST(7, COALESCE(_days, 30)));
  _now timestamptz := now();
  _from timestamptz;
  _prev_from timestamptz;
  _result jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_store_owner(_store_id, _uid) THEN RAISE EXCEPTION 'NOT_STORE_OWNER'; END IF;
  _from := _now - make_interval(days => _span);
  _prev_from := _from - make_interval(days => _span);

  WITH visits AS (
    SELECT t.id, t.customer_id, t.created_at
    FROM public.transactions t
    WHERE t.store_id = _store_id AND t.type = 'stamp_awarded' AND t.created_at >= _prev_from
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions r
        WHERE r.store_id = _store_id AND r.type = 'stamp_reversed'
          AND (r.metadata->>'reversed_transaction_id') = t.id::text
      )
  ),
  per_customer AS (
    SELECT customer_id,
           count(*) FILTER (WHERE created_at >= _from) AS now_visits,
           count(*) FILTER (WHERE created_at < _from) AS prev_visits
    FROM visits GROUP BY customer_id
  ),
  reminders AS (
    SELECT DISTINCT n.customer_id, n.created_at
    FROM public.notification_log n
    WHERE n.store_id = _store_id AND n.kind IN ('reminder', 'reward_reminder') AND n.created_at >= _from
  ),
  won AS (
    SELECT DISTINCT r.customer_id
    FROM reminders r
    JOIN visits v ON v.customer_id = r.customer_id
                 AND v.created_at > r.created_at
                 AND v.created_at <= r.created_at + interval '7 days'
  )
  SELECT jsonb_build_object(
    'days', _span,
    'returning', jsonb_build_object(
      'now',  (SELECT count(*) FROM per_customer WHERE now_visits >= 2),
      'prev', (SELECT count(*) FROM per_customer WHERE prev_visits >= 2)),
    'visits', jsonb_build_object(
      'now',  (SELECT count(*) FROM visits WHERE created_at >= _from),
      'prev', (SELECT count(*) FROM visits WHERE created_at < _from)),
    'newCustomers', jsonb_build_object(
      'now',  (SELECT count(*) FROM public.customer_memberships m WHERE m.store_id = _store_id AND m.joined_at >= _from),
      'prev', (SELECT count(*) FROM public.customer_memberships m WHERE m.store_id = _store_id AND m.joined_at >= _prev_from AND m.joined_at < _from)),
    'reminded', (SELECT count(DISTINCT customer_id) FROM reminders),
    'wonBack', (SELECT count(*) FROM won),
    'rewards', (SELECT count(*) FROM public.transactions t WHERE t.store_id = _store_id AND t.type = 'reward_redeemed' AND t.created_at >= _from),
    'offersUsed', (SELECT count(*) FROM public.offer_redemptions o WHERE o.store_id = _store_id AND o.status = 'used' AND o.used_at >= _from)
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.store_impact(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_impact(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
