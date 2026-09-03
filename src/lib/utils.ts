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

export const MAHMOUD_ADAMU_SIGNATURE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyODAgMTIwIiB3aWR0aD0iMjgwIiBoZWlnaHQ9IjEyMCI+PHBhdGggZD0iTSAxOCA3NSBRIDMyIDIwIDQ4IDIwIFEgNTggMjAgNjIgODIgUSA3NCAyNSA4OCAyNSBRIDk2IDI1IDEwMCA4MCBRIDEwNiA2MCAxMTQgNjAgUSAxMjIgNjAgMTI1IDc4IFEgMTMyIDUwIDE0MiA1MCBRIDE1MCA1MCAxNTIgNzUiIHN0cm9rZT0iIzFlMWI0YiIgc3Ryb2tlLXdpZHRoPSIyLjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgLz48cGF0aCBkPSJNIDE1OCA4NSBMIDE3MiAxNiBRIDE3OCAxNCAxODIgMzUgTCAxODggODAgUSAxOTYgNTUgMjA4IDU1IFEgMjE4IDU1IDIyMCA3OCBRIDIyOCA1OCAyMzggNTggUSAyNDggNTggMjUyIDc2IiBzdHJva2U9IiMxZTFiNGIiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+PHBhdGggZD0iTSAxMiA5NiBRIDkwIDcwIDIzMCA0OCBRIDI2MiA0MiAyNjggNTYgUSAyNzIgNzAgMjUyIDc2IFEgMjIwIDg0IDE4NSA4OCIgc3Ryb2tlPSIjMWUxYjRiIiBzdHJva2Utd2lkdGg9IjIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiAvPjxwYXRoIGQ9Ik0gMjggMTA0IFEgMTAwIDgyIDIyMCA2NCIgc3Ryb2tlPSIjMWUxYjRiIiBzdHJva2Utd2lkdGg9IjEuOCIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiAvPjxjaXJjbGUgY3g9IjI2NiIgY3k9IjM4IiByPSIyLjIiIGZpbGw9IiMxZTFiNGIiIC8+PC9zdmc+';
