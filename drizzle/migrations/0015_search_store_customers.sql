-- Cashier search by name: finds a customer however the name is typed (accents, Arabic letter variants,
-- Turkish dotted/dotless i, Russian ё/й, upper/lower case, any word order, a leading @ for usernames) and
-- searches the store's WHOLE customer list in the database instead of only the 300 most recent visitors.
-- Safe to run more than once.
CREATE OR REPLACE FUNCTION public.normalize_search_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT btrim(regexp_replace(
    translate(
      -- drop combining accents, Arabic diacritics/tatweel and invisible direction marks, then fold letters
      regexp_replace(lower(COALESCE(_value, '')), '[\u0300-\u036f\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2060\uFEFF]', '', 'g'),
      'áàâäãåāÁÀÂÄÃÅĀąĄăĂéèêëēÉÈÊËĒęĘěĚíìîïīıÍÌÎÏĪİóòôöõōÓÒÔÖÕŌőŐúùûüūÚÙÛÜŪůŮűŰçÇćĆčČñÑńŃňŇğĞşŞšŠśŚșȘžŽźŹżŻýÿÝŸřŘďĎťŤțȚёЁйЙИأإآٱىئؤةАБВГДЖЗКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
      'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeiiiiiiiiiiiioooooooooooooouuuuuuuuuuuuuuccccccnnnnnnggsssssssszzzzzzyyyyrrddttttееиииااااييوهабвгджзклмнопрстуфхцчшщъыьэюя'
    ),
    '\s+', ' ', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.search_store_customers(_store_id uuid, _query text, _limit integer DEFAULT 8)
RETURNS TABLE (
  customer_id uuid,
  first_name text,
  last_name text,
  username text,
  stamp_balance integer,
  stamps_required integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _uid uuid := auth.uid();
  _tokens text[];
  _max integer := GREATEST(1, LEAST(COALESCE(_limit, 8), 20));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _uid) OR public.is_store_owner(_store_id, _uid)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  _tokens := ARRAY(
    SELECT t FROM unnest(regexp_split_to_array(public.normalize_search_text(regexp_replace(COALESCE(_query, ''), '^\s*@', '')), ' ')) AS t WHERE t <> ''
  );
  IF COALESCE(array_length(_tokens, 1), 0) = 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT m.customer_id, p.first_name, p.last_name, p.username, m.stamp_balance, lp.stamps_required
  FROM public.customer_memberships m
  JOIN public.profiles p ON p.id = m.customer_id
  JOIN public.loyalty_programs lp ON lp.id = m.program_id
  CROSS JOIN LATERAL (
    SELECT public.normalize_search_text(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') || ' ' || COALESCE(p.username, '')) AS hay
  ) h
  WHERE m.store_id = _store_id
    -- every word typed must appear somewhere in the name or username (order does not matter)
    AND NOT EXISTS (SELECT 1 FROM unnest(_tokens) AS tok WHERE strpos(h.hay, tok) = 0)
  ORDER BY (left(h.hay, length(_tokens[1])) = _tokens[1]) DESC, m.last_visit_at DESC NULLS LAST, m.joined_at DESC
  LIMIT _max;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_search_text(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_store_customers(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_search_text(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_store_customers(uuid, text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
