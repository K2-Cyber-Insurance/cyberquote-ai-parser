/**
 * Validation utilities for quote fields
 */

// Allowed aggregate limit values (in dollars)
export const AGG_LIMIT_OPTIONS = [
  50000,
  100000,
  250000,
  500000,
  750000,
  1000000,
  2000000,
  3000000
];

// Allowed retention values (in dollars)
export const RETENTION_OPTIONS = [
  500,
  1000,
  2500,
  5000,
  10000,
  15000,
  25000,
  50000,
  75000,
  100000
];

/**
 * Formats a number as currency string (e.g., 1000000 -> "$1,000,000")
 */
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

/**
 * Normalizes aggregate limit value to the closest allowed option
 * @param value - The value to normalize (can be number, string, or null)
 * @param notes - Array to add notes to if value is adjusted
 * @returns Object with normalized value and optional note
 */
export function normalizeAggLimit(
  value: number | string | null,
  notes: string[]
): { value: number; note?: string } {
  if (value === null || value === undefined) {
    return { value: 0 };
  }

  // Convert to number
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  
  if (isNaN(numValue) || numValue <= 0) {
    return { value: 0 };
  }

  // Cap at maximum allowed value
  if (numValue > 3000000) {
    notes.push(`Aggregate limit requested (${formatCurrency(numValue)}) exceeds maximum allowed. Set to ${formatCurrency(3000000)}.`);
    return { value: 3000000 };
  }

  // Find closest matching value
  let closest = AGG_LIMIT_OPTIONS[0];
  let minDiff = Math.abs(numValue - closest);

  for (const option of AGG_LIMIT_OPTIONS) {
    const diff = Math.abs(numValue - option);
    if (diff < minDiff) {
      minDiff = diff;
      closest = option;
    }
  }

  // Add note if value was adjusted
  if (closest !== numValue) {
    notes.push(`Aggregate limit requested (${formatCurrency(numValue)}) does not match available options. Adjusted to ${formatCurrency(closest)}.`);
  }

  return { value: closest };
}

/**
 * Normalizes retention value to the closest allowed option
 * @param value - The value to normalize (can be number, string, or null)
 * @returns Normalized value or null if no reasonable match
 */
export function normalizeRetention(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Convert to number
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  
  if (isNaN(numValue) || numValue <= 0) {
    return null;
  }

  // Find closest matching value
  let closest: number | null = null;
  let minDiff = Infinity;

  for (const option of RETENTION_OPTIONS) {
    const diff = Math.abs(numValue - option);
    if (diff < minDiff) {
      minDiff = diff;
      closest = option;
    }
  }

  // Only return if the difference is reasonable (within 10% or $1000, whichever is larger)
  const threshold = Math.max(numValue * 0.1, 1000);
  if (closest !== null && minDiff <= threshold) {
    return closest;
  }

  return null;
}

