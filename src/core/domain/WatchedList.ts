/**
 * Tracks changes to a list of items within an aggregate.
 * Used for one-to-many relationships where we need to know what was added/removed.
 */
export abstract class WatchedList<T> {
  private currentItems: T[];
  private initialItems: T[];
  private newItems: Set<T> = new Set();
  private removedItems: Set<T> = new Set();

  constructor(initialItems: T[] = []) {
    this.currentItems = [...initialItems];
    this.initialItems = [...initialItems];
  }

  /**
   * Compare items for equality (override for complex types)
   */
  protected abstract compareItems(a: T, b: T): boolean;

  /**
   * Get all current items
   */
  getItems(): T[] {
    return [...this.currentItems];
  }

  /**
   * Get items that existed from the start
   */
  getInitialItems(): T[] {
    return [...this.initialItems];
  }

  /**
   * Get items added since creation
   */
  getNewItems(): T[] {
    return Array.from(this.newItems);
  }

  /**
   * Get items removed since creation
   */
  getRemovedItems(): T[] {
    return Array.from(this.removedItems);
  }

  /**
   * Check if list has changes
   */
  hasChanges(): boolean {
    return this.newItems.size > 0 || this.removedItems.size > 0;
  }

  /**
   * Check if item exists in current list
   */
  exists(item: T): boolean {
    return this.currentItems.some((i) => this.compareItems(i, item));
  }

  /**
   * Check if item was in initial list
   */
  wasInitial(item: T): boolean {
    return this.initialItems.some((i) => this.compareItems(i, item));
  }

  /**
   * Add item to list
   */
  add(item: T): void {
    if (this.exists(item)) {
      return;
    }

    // If it was previously removed, just restore it
    const wasRemoved = Array.from(this.removedItems).some((i) => this.compareItems(i, item));

    if (wasRemoved) {
      this.removedItems.delete(item);
    } else {
      this.newItems.add(item);
    }

    this.currentItems.push(item);
  }

  /**
   * Remove item from list
   */
  remove(item: T): void {
    if (!this.exists(item)) {
      return;
    }

    this.currentItems = this.currentItems.filter((i) => !this.compareItems(i, item));

    // If it was new, just remove from new items
    const wasNew = Array.from(this.newItems).some((i) => this.compareItems(i, item));

    if (wasNew) {
      this.newItems.delete(item);
    } else {
      this.removedItems.add(item);
    }
  }

  /**
   * Replace all items
   */
  replace(items: T[]): void {
    // Mark all current as removed
    for (const item of this.currentItems) {
      if (!items.some((i) => this.compareItems(i, item))) {
        this.remove(item);
      }
    }

    // Add new ones
    for (const item of items) {
      if (!this.exists(item)) {
        this.add(item);
      }
    }
  }

  /**
   * Count of current items
   */
  count(): number {
    return this.currentItems.length;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.currentItems.length === 0;
  }

  /**
   * Clear all tracking (call after persistence)
   */
  commit(): void {
    this.initialItems = [...this.currentItems];
    this.newItems.clear();
    this.removedItems.clear();
  }
}

/**
 * Simple implementation for primitive types (string, number)
 */
export class PrimitiveWatchedList<T extends string | number> extends WatchedList<T> {
  protected compareItems(a: T, b: T): boolean {
    return a === b;
  }
}

/**
 * Implementation for objects with ID
 */
export class IdentifiedWatchedList<
  T extends { getId(): { toString(): string } },
> extends WatchedList<T> {
  protected compareItems(a: T, b: T): boolean {
    return a.getId().toString() === b.getId().toString();
  }
}
