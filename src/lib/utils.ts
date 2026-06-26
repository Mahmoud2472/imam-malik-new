import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const MAHMOUD_ADAMU_SIGNATURE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCI+PHBhdGggZD0iTSAxNSA3NSBRIDg1IDU1IDE3NSAyNSIgc3Ryb2tlPSIjMWU0MGFmIiBzdHJva2Utd2lkdGg9IjIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiAvPjxwYXRoIGQ9Ik0gMzAgODAgUSA5NSA2NSAxNTUgNTAiIHN0cm9rZT0iIzFlNDBhZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+PHBhdGggZD0iTSA2MCA3MCBMIDY0IDMwIFEgNzIgMjAgNzYgMzggTCA4MCA2NSBMIDg1IDM1IFEgOTIgMjUgOTYgNDIgTCAxMDAgNjAgUSAxMDQgMzggMTA4IDM0IFEgMTEyIDMwIDExNSA0MiBMIDExOCA1NSBRIDEyMiAzOCAxMjYgMzYgTCAxMzAgNTAiIHN0cm9rZT0iIzFlNDBhZiIgc3Ryb2tlLXdpZHRoPSIyLjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgLz48cGF0aCBkPSJNIDEzMCA1MCBDIDEzOCAzMCwgMTQ4IDI1LCAxNTUgMjggQyAxNjIgMzIsIDE2OCA0OCwgMTc1IDM1IEMgMTgyIDIyLCAxODYgMjIsIDE4NiAzNSBDIDE4NiA1MCwgMTcyIDYyLCAxNjUgNjYgQyAxNTggNzAsIDE0NCA3NCwgMTIyIDc2IiBzdHJva2U9IiMxZTQwYWYiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+PC9zdmc+';
