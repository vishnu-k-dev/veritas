-- infra/migration_v4_jwt_hook.sql
--
-- Auth rewrite: embed `role` in the JWT via a Custom Access Token Hook so the
-- frontend can route on first render with no profile-fetch round-trip. Also
-- creates a trigger that auto-creates a public.users row on auth.users INSERT
-- so backend code can stop doing lazy getOrCreate.
--
-- Apply via Supabase SQL editor, then enable the hook at:
--   Dashboard → Authentication → Hooks → Custom Access Token Hook
--   → public.custom_access_token_hook

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Make firebase_uid nullable (legacy column from migration era).
--    Pure Supabase users have no firebase_uid; the trigger below would fail
--    if the column is still NOT NULL.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ALTER COLUMN firebase_uid DROP NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Auto-create public.users row whenever a new auth.users row appears.
--    Default role = NULL (which signals "needs onboarding" to the frontend).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Custom Access Token Hook — embed `user_role` claim in every JWT.
--
--    Reads role from public.users.role at token issuance time. If the row is
--    missing or role is NULL, the claim is omitted (frontend treats the
--    absence as "needs onboarding").
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  claims := event->'claims';

  SELECT role INTO user_role
    FROM public.users
   WHERE id = (event->>'user_id')::uuid;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Grants — supabase_auth_admin must be able to execute the hook and read
--    public.users to compute the claim. Other roles get no extra access.
-- ───────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT SELECT ON TABLE public.users TO supabase_auth_admin;

DROP POLICY IF EXISTS "auth admin reads users for hook" ON public.users;
CREATE POLICY "auth admin reads users for hook"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
