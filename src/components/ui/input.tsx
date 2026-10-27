import * as React from "react";
import { cn } from "@/lib/utils";
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn("flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
));
Input.displayName = "Input";
export { Input };

/** Normalizes what is typed into a decimal field: a comma (phone keyboards in Albanian/Italian give ",") becomes the
 *  decimal point. Only digits and one point are kept. */
export function toDecimalText(raw: string) {
  let v = raw.replace(/\s/g, "");
  // Both separators present: the last one is the decimal separator ("1.234,5" and "1,234.5" are both 1234.5).
  if (v.includes(",") && v.includes(".")) v = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(/,/g, ".") : v.replace(/,/g, "");
  else v = v.replace(/,/g, ".");
  v = v.replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  return dot < 0 ? v : v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
}

/** A text field with the phone's decimal keypad that accepts both "," and "." as the decimal separator.
 *  Number inputs drop the comma on many phones, turning 1234,65 into 123465. */
const DecimalInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(({ onChange, ...props }, ref) => (
  <Input ref={ref} type="text" inputMode="decimal" autoComplete="off" {...props} onChange={e => {
    const v = toDecimalText(e.target.value);
    if (v !== e.target.value) e.target.value = v;
    onChange?.(e);
  }} />
));
DecimalInput.displayName = "DecimalInput";
export { DecimalInput };
