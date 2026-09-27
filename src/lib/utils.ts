import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Drops trailing zeros for reading ("19.000000" → "19"); copy the raw value instead. */
export const trimAmount = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
};
