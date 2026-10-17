<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the Ocean Deep semantic token system with Sora headings and Manrope body text so every business module shares one responsive visual language.
- Keep device-specific layout density, sidebar, invoice column widths, and shortcut assignments in the shared workspace preferences context so every module stays synchronized.
- Publish page actions through the shared workspace command event so configurable shortcuts never depend on page-specific keyboard listeners.
- Define shortcut labels, defaults and typed navigation destinations in one browser-safe command registry; settings and dispatch use it so new options cannot have nonfunctional assignments.
- Route invoices, edits, settlements, returns, journals and stock changes through company-scoped security-invoker transactions with payload-bound retry identifiers; this prevents partial writes and duplicate uncertain retries while preserving invoice IDs.
- Verify financial transaction SQL in isolated PostgreSQL with the production schema and company policies; this tests real rollback and reconciliation without changing external business data.
- Derive new invoice numbers from the highest matching series number across all visible company bills and recheck before saving; recent-list counts and component defaults are not sequence sources.
- Keep the customer storefront at / and every management page under the shared /admin parent, which gates its Outlet before any dashboard shell mounts; this shows only login to signed-out visitors and retains old URLs as redirects.
- Store online listing metadata separately from real stock and expose only explicit customer-safe fields through the online_catalog RPC; this keeps unpublished products and private inventory fields inaccessible to guests.
- Validate guest orders and owner status changes in transactional SQL RPCs; confirmation reserves stock and cancellation restores it without treating an unbilled order as a paid sales invoice.
- Upload online product photos through the connected database Storage API with company-prefixed object paths; this preserves company ownership without embedding images in database rows.
- Use shared normalized, all-word matching on explicit searchable fields and paginate complete searchable datasets with stable ordering; this prevents inconsistent matching and missing older records.
- Persist reference invoice header and item extras as invoice-owned snapshots, including inside the existing sales-update transaction; this keeps reopened entries independent of later stock edits.
- Keep invoice entry in a viewport-sized workspace with compact navigation and independent item scrolling; this keeps header, totals, details and actions visible together without changing other admin pages.
- Execute stock cleanup, product-detail edits and full barcode resequencing through one company-scoped security-invoker transaction with reviewed old-value checks; block deletion of nonzero stock or products with business history to prevent cascading data loss.
- Keep shared reference masters company-scoped and use existing products, customers and accounts as the only product/party/ledger records; transactional product saves and reference-rename triggers synchronize live links while preserving invoice snapshots.
- Preserve mounted entry state on focus, reconnect and same-user auth notifications: clear cached private data only on identity changes, and initialize editable forms only when their record identity changes.
- Use one shared horizontal category-dropdown navigation in every admin workspace instead of parallel sidebar and invoice menus; this keeps management destinations consistent without changing page state or permissions.
- Use an invoice-owned party dialog for selection and creation through the existing company-scoped customers table; guard invoice commands while it is open to prevent a party save from submitting the bill.
- Maintain numbered Setup scripts in a single browser-safe registry with prerequisites so copy and download expose the same ordered updates.
- Render invoice product suggestions through a body portal with viewport-bounded positioning so transformed and scroll-clipped workspace ancestors cannot hide results.
- Expose only the earliest company's logo through public_shop_brand and serve a padded square PNG through the public brand-icon endpoint; a stable primary-company identity prevents private workspace switching from changing the site favicon.
