import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * دمج الكلاسات بطريقة ذكية (مفيد لـ tailwind)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
