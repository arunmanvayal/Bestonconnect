export const INVOICE_ENTRY_SQL = `
-- Additional entry fields are snapshots, never live product-derived values on reprint.
alter table public.invoices add column if not exists entry_details jsonb not null default '{}'::jsonb;
alter table public.invoice_items add column if not exists entry_details jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
`;