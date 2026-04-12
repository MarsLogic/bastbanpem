import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Elite String Normalization: Trims, Uppercases and collapses whitespace.
 */
export function formatDataString(str: string): string {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function normalizeLabel(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[:\.]/g, '');
}
