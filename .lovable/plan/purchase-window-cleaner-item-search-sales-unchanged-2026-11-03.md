# Purchase window: cleaner item search (Sales unchanged)

## Problem
In the Purchase Invoice, typing "4" in Item Code shows a long list of unrelated items (codes 6, 8, 9, 10...) because the search also looks inside barcodes, names, HSN etc. for any "4".

## Changes (Purchase window only)
1. **Item Code search** matches only the product's item code:
   - Exact code first (typing 4 shows code 4 at the top), then codes starting with what you typed (40, 41, 400...).
   - Pressing Enter on an exact code fills the product straight away (as today).
   - Barcodes, names, HSN, category are no longer searched from this box.
2. **Barcode column** becomes a plain entry box with no search dropdown — used only to type or keep the newly generated barcode.
3. **Item Name search** stays as it is (searches by name), but no longer matches by barcode.

## Not changed
- Sales window: barcode search, item code search and item name search work exactly as now.
- Barcode auto-generation during purchase stays the same.

## Technical details
- `InvoiceForm.tsx`: when `kind === "purchase"`, build `matches` with col-specific logic — `sku`: exact then prefix match on `p.sku`, sorted by code; `item`: `matchesSearch` over name/category/manufacturer/hsn without barcode. Sale path keeps the current filter.
- `InvoiceEntryGrid.tsx`: for purchase, render the barcode cell with the plain `input("barcode", ...)` instead of `searchCell`.
- Add a small test for the purchase code-match helper (typing "4" returns code 4 first and excludes code 6).
