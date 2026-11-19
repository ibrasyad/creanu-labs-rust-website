export const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const FUNNEL_STEPS = [
  'landing_page',
  'product_view',
  'add_to_cart',
  'checkout',
  'paid',
] as const;

export const CONVERSION_STEPS = [
  { key: 'landing_page', label: 'Landing -> View', fallback: 0.65 },
  { key: 'product_view', label: 'View -> Cart', fallback: 0.5 },
  { key: 'add_to_cart', label: 'Cart -> Checkout', fallback: 0.6 },
  { key: 'checkout', label: 'Checkout -> Paid', fallback: 0.7 },
] as const;

export type UpdateFieldFn = (path: string[], value: unknown) => void;
export type MutateConfigFn = (mutator: (cfg: any) => void) => void;

export function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
