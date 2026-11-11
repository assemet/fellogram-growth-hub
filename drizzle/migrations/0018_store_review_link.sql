-- "Rate us" link for each store (Google, Facebook, TripAdvisor, ...), plus a log kind for the "reward collected" message.
-- The app only accepts links on known review sites; the CHECK is a second line of defence so only a plain
-- http(s) link can be stored. Safe to run more than once.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS review_url text;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_review_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_review_check
  CHECK (review_url IS NULL OR (review_url ~ '^https?://[^[:space:]]+$' AND char_length(review_url) <= 300));

DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS notification_log_kind_check;
    ALTER TABLE public.notification_log ADD CONSTRAINT notification_log_kind_check
      CHECK (kind IN ('stamp', 'near_reward', 'reward_ready', 'reminder', 'reward_redeemed'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
