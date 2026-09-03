-- helpers
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  telegram_user_id BIGINT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stores_owner_idx ON public.stores(owner_id);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_select_active" ON public.stores FOR SELECT USING (active OR owner_id = auth.uid());
CREATE POLICY "stores_insert_own" ON public.stores FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_update_own" ON public.stores FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_delete_own" ON public.stores FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- store_members
CREATE TYPE public.store_role AS ENUM ('owner','staff');
CREATE TABLE public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.store_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX store_members_user_idx ON public.store_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_members TO authenticated;
GRANT ALL ON public.store_members TO service_role;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_store_member(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_members WHERE store_id = _store_id AND user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_members WHERE store_id = _store_id AND user_id = _user_id AND role = 'owner')
     OR EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = _user_id);
$$;

CREATE POLICY "store_members_select" ON public.store_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_store_owner(store_id, auth.uid()));
CREATE POLICY "store_members_owner_manage" ON public.store_members FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid())) WITH CHECK (public.is_store_owner(store_id, auth.uid()));

-- loyalty_programs
CREATE TABLE public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stamps_required INTEGER NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 1 AND 100),
  active BOOLEAN NOT NULL DEFAULT true,
  referrals_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_programs_store_idx ON public.loyalty_programs(store_id);
GRANT SELECT ON public.loyalty_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select_all" ON public.loyalty_programs FOR SELECT USING (true);
CREATE POLICY "programs_owner_manage" ON public.loyalty_programs FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid())) WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE TRIGGER programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- rewards
CREATE TYPE public.reward_kind AS ENUM ('standard','referral','welcome');
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  program_id UUID REFERENCES public.loyalty_programs ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stamps_required INTEGER NOT NULL DEFAULT 10 CHECK (stamps_required >= 0),
  kind public.reward_kind NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rewards_store_idx ON public.rewards(store_id);
GRANT SELECT ON public.rewards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_select_all" ON public.rewards FOR SELECT USING (true);
CREATE POLICY "rewards_owner_manage" ON public.rewards FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid())) WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE TRIGGER rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- customer_memberships
CREATE TABLE public.customer_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stamp_balance INTEGER NOT NULL DEFAULT 0 CHECK (stamp_balance >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, customer_id)
);
CREATE INDEX memberships_customer_idx ON public.customer_memberships(customer_id);
CREATE INDEX memberships_store_idx ON public.customer_memberships(store_id);
GRANT SELECT, INSERT, UPDATE ON public.customer_memberships TO authenticated;
GRANT ALL ON public.customer_memberships TO service_role;
ALTER TABLE public.customer_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_select" ON public.customer_memberships FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_store_member(store_id, auth.uid()) OR public.is_store_owner(store_id, auth.uid()));
CREATE POLICY "memberships_insert_own" ON public.customer_memberships FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON public.customer_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- transactions (immutable ledger; writes happen server-side)
CREATE TYPE public.transaction_type AS ENUM ('stamp_awarded','stamp_reversed','reward_redeemed','referral_reward');
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  staff_id UUID REFERENCES auth.users ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  related_reward_id UUID REFERENCES public.rewards ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_store_created_idx ON public.transactions(store_id, created_at DESC);
CREATE INDEX transactions_cooldown_idx ON public.transactions(store_id, customer_id, type, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_store_member(store_id, auth.uid()) OR public.is_store_owner(store_id, auth.uid()));

-- redemptions
CREATE TYPE public.redemption_status AS ENUM ('pending','used','expired');
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX redemptions_customer_idx ON public.redemptions(customer_id, status);
GRANT SELECT ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_select" ON public.redemptions FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_store_member(store_id, auth.uid()) OR public.is_store_owner(store_id, auth.uid()));

-- referrals
CREATE TYPE public.referral_status AS ENUM ('pending','qualified','rewarded');
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  referrer_customer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  referred_customer_id UUID REFERENCES auth.users ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  status public.referral_status NOT NULL DEFAULT 'pending',
  qualifying_transaction_id UUID REFERENCES public.transactions ON DELETE SET NULL,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX referrals_one_welcome_per_store ON public.referrals(store_id, referred_customer_id) WHERE referred_customer_id IS NOT NULL;
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_customer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_customer_id = auth.uid() OR referred_customer_id = auth.uid() OR public.is_store_owner(store_id, auth.uid()));