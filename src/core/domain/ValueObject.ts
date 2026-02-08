/**
 * Abstract base class for Value Objects.
 *
 * Characteristics:
 * - Immutable (cannot be changed after creation)
 * - No identity (equality based on attributes)
 * - Lifecycle managed by parent entity
 * - Replaceable (create new instance instead of modifying)
 */

export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Structural equality comparison
   * Two value objects are equal if their properties are equal
   */
  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  /**
   * Get the raw properties (for persistence)
   */
  getProps(): T {
    return this.props;
  }

  /**
   * Convert to plain object (for serialization)
   */
  toJSON(): T {
    return this.props;
  }
}

/**
 * Utility type for shallow equality check of plain objects
 */
export type Primitives = string | number | boolean | Date | undefined | null;

/**
 * Helper to check if two values are deeply equal
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (a === null || b === null) return false;

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEquals(objA[key], objB[key])) return false;
  }

  return true;
}
