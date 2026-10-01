# Collapsible workspace, adjustable entry grids, and shortcuts

## Scope

- Add a desktop sidebar collapse control that switches between the full navigation and an icon-only rail, with labels available as tooltips. Keep the existing phone navigation unchanged.
- Animate the sidebar, desktop header, and page content widths together so collapsing never covers content.
- Add a workspace preferences panel accessible from the desktop header for layout density and keyboard shortcuts.

## Entry screen sizing

- Provide **Compact**, **Standard**, and **Spacious** density presets for entry forms and tables.
- Apply the chosen density consistently to Sales, Purchase, Sales Returns, Receipts & Payments, and Stock entry areas.
- Add draggable column edges to the Sales and Purchase item grids, preserving practical minimum widths and horizontal scrolling on small screens.
- Include a reset action for custom column widths.
- Store density and column preferences on the current device so they remain after reopening the app.

## Keyboard shortcuts

- Let computer users customize shortcuts for Save, Add row, Remove row, Print, Refresh, and Focus product search.
- Also support navigation shortcuts for Dashboard, Sales, Purchase, Customers, Accounts, Receipts & Payments, Sales Returns, Ledger, Stock, and Reports.
- Prevent duplicate assignments, ignore shortcuts while typing unless the shortcut intentionally targets an action, and prevent browser defaults for assigned function keys such as F12.
- Show the active shortcut in relevant button tooltips/labels where space allows.
- Persist shortcut preferences on the current device and provide reset-to-defaults.

## Technical details

- Create one client-safe preferences layer shared by the layout and entry screens, with hydration-safe browser storage access.
- Use semantic Ocean Deep tokens and the existing Sora/Manrope design language.
- Expose page actions through a small event-based command system so global shortcuts can trigger only actions available on the current screen.
- Update project architecture notes for the shared preferences and command system.

## Verification

- Verify sidebar collapse/expand and content alignment on desktop.
- Verify density changes, draggable invoice columns, and reset behavior.
- Verify custom F12 Save, duplicate shortcut validation, navigation shortcuts, and typing safeguards.
- Check Sales, Purchase, Returns, Payments, and Stock at phone, tablet, and desktop sizes, then confirm the latest build is clean.
