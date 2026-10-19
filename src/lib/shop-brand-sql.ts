export const SHOP_BRAND_SQL = `
-- Public site branding only. Company profiles and financial fields stay private.
-- The oldest company is the site's primary brand; active-company switching
-- must not change the public site's identity for guests or Google.
create or replace function public.public_shop_brand() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object('logo', coalesce((
    select c.logo from public.companies c order by c.created_at, c.id limit 1
  ), ''));
$fn$;
revoke all on function public.public_shop_brand() from public;
grant execute on function public.public_shop_brand() to anon, authenticated;
notify pgrst, 'reload schema';
`;

export const SHOP_BRAND_LOGO_FIX_SQL = `
-- Use the earliest company that actually has an uploaded logo, so an older
-- company without a logo no longer hides the brand logo from the shop and favicon.
create or replace function public.public_shop_brand() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object('logo', coalesce((
    select c.logo from public.companies c
    where coalesce(c.logo, '') <> ''
    order by c.created_at, c.id limit 1
  ), ''));
$fn$;
revoke all on function public.public_shop_brand() from public;
grant execute on function public.public_shop_brand() to anon, authenticated;
notify pgrst, 'reload schema';
`;
