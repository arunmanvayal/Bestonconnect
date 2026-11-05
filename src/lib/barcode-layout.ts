export type LabelLayout = { width: number; height: number; gapX: number; gapY: number; marginTop: number; marginLeft: number };
export const DEFAULT_LAYOUT: LabelLayout = { width: 48.5, height: 25.4, gapX: 2.5, gapY: 0, marginTop: 21.5, marginLeft: 5 };
export const LAYOUT_KEY = "barcode-label-layout";

/** How many labels (mm sizes) fit across and down an A4 sheet (210 × 297 mm), keeping the margins on both sides. */
export function fitLabels(l: LabelLayout) {
  const fit = (page: number, margin: number, size: number, gap: number) => size > 0 ? Math.max(0, Math.floor((page - 2 * margin + gap) / (size + gap))) : 0;
  const cols = fit(210, l.marginLeft, l.width, l.gapX), rows = fit(297, l.marginTop, l.height, l.gapY);
  return { cols, rows, perSheet: cols * rows };
}
