export function suggestionPosition(rect: { left: number; top: number; bottom: number; width: number }, viewport: { width: number; height: number }) {
  const width = Math.min(Math.max(rect.width, 320), viewport.width - 16);
  const below = viewport.height - rect.bottom - 12;
  const above = rect.top - 12;
  const useAbove = below < 160 && above > below;
  const maxHeight = Math.min(288, Math.max(40, useAbove ? above : below));
  return { left: Math.max(8, Math.min(rect.left, viewport.width - width - 8)), top: useAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4, width, maxHeight };
}