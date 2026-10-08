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
