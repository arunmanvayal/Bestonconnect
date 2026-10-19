import { SETUP_SQL, INVOICE_SQL, COMPANY_SQL, USERNAME_SQL, IMPORT_SQL } from "@/lib/schema-sql";
import { INVOICE_ENTRY_SQL } from "@/lib/invoice-entry-sql";
import { INVOICE_EDIT_SQL } from "@/lib/invoice-edit-sql";
import { MASTERS_SQL } from "@/lib/masters-sql";
import { ONLINE_SHOP_SQL } from "@/lib/online-shop-sql";
import { STOCK_MAINTENANCE_SQL } from "@/lib/stock-maintenance-sql";
import { FINANCIAL_TRANSACTIONS_SQL } from "@/lib/financial-transactions-sql";
import { FINANCIAL_IMPORT_SQL } from "@/lib/financial-import-sql";
import { STOCK_BARCODE_FAST_SQL } from "@/lib/stock-barcode-fast-sql";
import { SHOP_BRAND_SQL, SHOP_BRAND_LOGO_FIX_SQL } from "@/lib/shop-brand-sql";

export const setupScripts = [
  { number: 1, title: "Core business tables", change: "Creates customers, accounts, stock and journal tables.", sql: SETUP_SQL },
  { number: 2, title: "Invoices, payments and returns", change: "Creates invoice items, receipts, payments and sales returns.", sql: INVOICE_SQL },
  { number: 3, title: "Companies and private access", change: "Adds company ownership, company-scoped access and workspace settings.", sql: COMPANY_SQL },
  { number: 4, title: "Username login", change: "Adds username profiles and username lookup for sign-in.", sql: USERNAME_SQL },
  { number: 5, title: "Spreadsheet fields", change: "Adds product and party fields used by Excel sheets.", sql: IMPORT_SQL },
  { number: 6, title: "Reference invoice fields", change: "Adds invoice header and item detail snapshots.", sql: INVOICE_ENTRY_SQL },
  { number: 7, title: "Original sales editing support", change: "Adds the earlier sales update function; step 11 installs the current financial transactions.", sql: INVOICE_EDIT_SQL },
  { number: 8, title: "Products and linked Masters", change: "Adds product tax rates, alternate units, shared Masters and transactional product saving.", sql: MASTERS_SQL },
  { number: 9, title: "Online products and orders", change: "Adds public catalog access, listings, orders and stock reservations. Product photos use the online-products Storage bucket.", sql: ONLINE_SHOP_SQL },
  { number: 10, title: "Stock cleanup and barcodes", change: "Adds protected stock cleanup, product editing and barcode resequencing.", sql: STOCK_MAINTENANCE_SQL },
  { number: 11, title: "Financial consistency update", change: "Installs atomic invoices, purchase edits, payments, returns, stock and journals; unified tax, KFC, alternate units, snapshots and linked-record protection.", sql: FINANCIAL_TRANSACTIONS_SQL },
  { number: 12, title: "All-or-nothing Excel import", change: "Installs transactional product, customer, supplier and ledger imports with stock movements.", sql: FINANCIAL_IMPORT_SQL },
  { number: 13, title: "Fast barcode series for large stock", change: "Rewrites stock cleanup and barcode resequencing as bulk updates so thousands of products save without a statement timeout.", sql: STOCK_BARCODE_FAST_SQL },
  { number: 14, title: "Shared shop logo and Google favicon", change: "Makes only the primary company's uploaded logo public for the shop and square browser/Google icon. Company details remain private. The primary brand is the first company created.", sql: SHOP_BRAND_SQL },
  { number: 15, title: "Logo fix: use the company that has a logo", change: "The shop and browser/Google icon now use the earliest company with an uploaded logo, so an older company without a logo no longer blocks it.", sql: SHOP_BRAND_LOGO_FIX_SQL },
] as const;

export function numberedSetupSql(script: typeof setupScripts[number]) {
  return `-- Setup ${String(script.number).padStart(2, "0")}: ${script.title}\n-- ${script.change}\n-- Prerequisites: ${script.number === 1 ? "New database. Continue through all steps before using the app." : `Complete steps 01–${String(script.number - 1).padStart(2, "0")} first, unless already installed.`}\n-- Run the complete script, not selected lines.\n\n${script.sql}`;
}