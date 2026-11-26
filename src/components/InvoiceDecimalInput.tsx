import { useState } from "react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { parseEntryDecimal } from "@/lib/invoice-entry";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  formatValue?: (value: number) => string;
  toStoredValue?: (value: number) => number;
  onValueChange: (value: number) => void;
};

/** Retain the typed decimal text while publishing numeric values for live totals. */
export function InvoiceDecimalInput({ value, formatValue = String, toStoredValue = v => v, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState<{ text: string; value: number } | null>(null);
  return <Input {...props} type="text" inputMode="decimal" autoComplete="off"
    value={draft && Object.is(draft.value, value) ? draft.text : formatValue(value)}
    onChange={event => {
      const text = event.target.value;
      const parsed = parseEntryDecimal(text);
      if (parsed === null) return;
      const stored = toStoredValue(parsed);
      setDraft({ text, value: stored });
      onValueChange(stored);
    }} />;
}