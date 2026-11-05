/**
 * DatePicker shim — re-exports the PO codebase's SystemDatePicker under
 * the name the SO-ported AttachmentsTab expects (`../ui/date-picker`).
 * Prop shape matches SO's date-picker: `value` / `onChange` speak ISO
 * `YYYY-MM-DD` strings, plus `placeholder` / `className` / `align`.
 *
 * `fromYear` / `toYear` (used by SO's filter modal for constrained
 * year ranges) map to `min` / `max` Date objects that SystemDatePicker
 * already supports.
 */

import * as React from "react";
import { SystemDatePicker } from "../_dashboardModalKit";

export interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  fromYear?: number;
  toYear?: number;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  align = "start",
  fromYear,
  toYear,
  disabled,
}: DatePickerProps) {
  const min = fromYear ? new Date(fromYear, 0, 1) : undefined;
  const max = toYear ? new Date(toYear, 11, 31) : undefined;
  return (
    <SystemDatePicker
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      align={align}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
}
