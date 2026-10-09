export type EntryDetails = {
  cost_centre: string; source: string; voucher_no: string; order_date: string; order_no: string;
  agent: string; order_details: string; despatch_details: string; vehicle_details: string;
  entry_date: string; kfc_amount: string;
};
export const emptyEntryDetails = (date: string): EntryDetails => ({ cost_centre: "MAIN", source: "", voucher_no: "", order_date: date, order_no: "", agent: "NONE", order_details: "", despatch_details: "", vehicle_details: "", entry_date: date, kfc_amount: "" });
export function discountAmount(gross: number, percent: number) { return Math.round(Math.max(0, gross) * Math.min(100, Math.max(0, percent)) * 100 / 100) / 100; }
export function discountPercent(gross: number, amount: number) { return gross > 0 ? Math.round(amount / gross * 10000) / 100 : 0; }