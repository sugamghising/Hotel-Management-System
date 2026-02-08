import type { DomainEvent } from './DomainEvent';
import { Entity } from './Entity';
import type { Identifier } from './Identifier';

/**
 * Abstract base class for Aggregate Roots.
 *
 * An Aggregate is a cluster of associated objects treated as a unit for data changes.
 * The Aggregate Root is the entry point and enforces invariants across the entire aggregate.
 *
 * Rules:
 * - External references can only point to the Aggregate Root
 * - Aggregate members can hold references to other aggregate roots by ID only
 * - A transaction should modify only one aggregate
 * - Delete operation must remove everything within the aggregate boundary
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  private _isModified: boolean = false;

  /**
   * Mark aggregate as modified (dirty)
   */
  protected markModified(): void {
    this._isModified = true;
  }

  /**
   * Check if aggregate has been modified
   */
  isModified(): boolean {
    return this._isModified;
  }

  /**
   * Clear modified flag (called by repository after persistence)
   */
  clearModified(): void {
    this._isModified = false;
  }

  /**
   * Add domain event and mark as modified
   */
  protected override addDomainEvent(event: DomainEvent): void {
    super.addDomainEvent(event);
    this.markModified();
  }

  /**
   * Get aggregate ID (alias for getId)
   */
  getAggregateId(): Identifier {
    return this.getId();
  }

  /**
   * Load aggregate from persistence
   * Override to reconstruct complex aggregates with nested entities
   */
  static load<T>(
    _props: T,
    _id: Identifier,
    _version: number,
    _events?: DomainEvent[]
  ): AggregateRoot<T> {
    throw new Error('Load method must be implemented by subclass');
  }

  /**
   * Apply event sourcing event to rebuild state
   */
  protected abstract applyEvent(event: DomainEvent): void;

  /**
   * Rehydrate aggregate from event stream
   */
  rehydrate(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
    this.clearDomainEvents(); // Replayed events shouldn't be published again
  }
}

/**
 * Interface for aggregate repositories
 */
export interface IAggregateRepository<T extends AggregateRoot<unknown>> {
  findById(id: Identifier): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(aggregate: T): Promise<void>;
}
