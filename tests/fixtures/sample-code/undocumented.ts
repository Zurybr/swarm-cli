/**
 * Sample undocumented code for testing documentation analysis
 * Contains functions with missing or incomplete JSDoc
 */

// Missing JSDoc - exported function without documentation
export function calculateTotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Missing JSDoc - another exported function
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Has JSDoc but missing parameter documentation
 * @returns The formatted date string
 */
export function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const map: Record<string, string> = {
    'YYYY': date.getFullYear().toString(),
    'MM': pad(date.getMonth() + 1),
    'DD': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds()),
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => map[match]);
}

/**
 * Has JSDoc but wrong parameter type documented
 * @param {string} value - The value to parse (documented as string but should be unknown)
 * @returns The parsed value
 */
export function safeParse(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Has JSDoc but missing @returns tag
 * @param a - First number
 * @param b - Second number
 */
export function addNumbers(a: number, b: number): number {
  return a + b;
}

// Not exported - doesn't need JSDoc
function internalHelper(data: unknown): string {
  return String(data).toLowerCase().trim();
}

/**
 * Class with methods that have documentation issues
 */
export class DataProcessor {
  private items: unknown[] = [];

  // Missing JSDoc on public method
  addItem(item: unknown): void {
    this.items.push(item);
  }

  /**
   * Missing parameter documentation
   * @returns The filtered items
   */
  filterItems(predicate: (item: unknown) => boolean): unknown[] {
    return this.items.filter(predicate);
  }

  /**
   * Wrong return type documented
   * @returns {string} The count (documented as string but returns number)
   */
  getCount(): number {
    return this.items.length;
  }
}

// Exported constant without documentation
export const DEFAULT_CONFIG = {
  timeout: 5000,
  retries: 3,
  enabled: true,
};

// Exported type without documentation
export type UserRole = 'admin' | 'user' | 'guest';

/**
 * Function with drift between JSDoc and implementation
 * @param {string} name - The user name
 * @param {number} age - The user age
 * @param {string} email - The user email (documented but not in implementation)
 * @returns {object} The user object
 */
export function createUserProfile(name: string, age: number): { name: string; age: number } {
  return { name, age };
}
