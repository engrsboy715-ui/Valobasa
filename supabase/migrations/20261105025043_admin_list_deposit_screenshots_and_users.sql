DROP FUNCTION IF EXISTS public.admin_list_deposits();

CREATE FUNCTION public.admin_list_deposits()
RETURNS TABLE(
  id uuid, user_id uuid, user_name text, amount numeric, method text,
  sender_number text, trx_id text, screenshot text, status text, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT d.id, d.user_id, d.user_name, d.amount, d.method, d.sender_number,
           d.trx_id, d.screenshot, d.status, d.created_at
    FROM deposits d
    ORDER BY d.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_deposits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_deposits() TO authenticated;

CREATE FUNCTION public.admin_list_users()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY SELECT p.* FROM profiles p ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
