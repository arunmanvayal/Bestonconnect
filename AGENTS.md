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
- Update saved sales invoices through one company-scoped, security-invoker SQL transaction that preserves invoice IDs; this prevents partial stock or ledger changes on failure.
- Derive new invoice numbers from the highest matching series number across all visible company bills and recheck before saving; recent-list counts and component defaults are not sequence sources.
- Keep the customer storefront at / and every management page under the shared /admin parent, which gates its Outlet before any dashboard shell mounts; this shows only login to signed-out visitors and retains old URLs as redirects.
- Store online listing metadata separately from real stock and expose only explicit customer-safe fields through the online_catalog RPC; this keeps unpublished products and private inventory fields inaccessible to guests.
- Validate guest orders and owner status changes in transactional SQL RPCs; confirmation reserves stock and cancellation restores it without treating an unbilled order as a paid sales invoice.
- Upload online product photos through the connected database Storage API with company-prefixed object paths; this preserves company ownership without embedding images in database rows.
- Use shared normalized, all-word matching on explicit searchable fields and paginate complete searchable datasets with stable ordering; this prevents inconsistent matching and missing older records.
- Persist reference invoice header and item extras as invoice-owned snapshots, including inside the existing sales-update transaction; this keeps reopened entries independent of later stock edits.
- Execute stock cleanup, product-detail edits and full barcode resequencing through one company-scoped security-invoker transaction with reviewed old-value checks; block deletion of nonzero stock or products with business history to prevent cascading data loss.
