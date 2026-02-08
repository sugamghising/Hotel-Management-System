import type { DomainEvent } from './DomainEvent';
import { Identifier } from './Identifier';

/**
 * Abstract base class for all Entities.
 * 
 * Characteristics:
 * - Has a unique identity (ID)
 - Mutable state
 * - Equality based on ID, not attributes
 * - Tracks domain events
 */

export abstract class Entity<T> {
  protected readonly id: Identifier;
  protected props: T;
  private domainEvents: DomainEvent[] = [];
  private version: number = 0;

  constructor(props: T, id?: Identifier) {
    this.id = id ? id : new Identifier();
    this.props = props;
  }

  /**
   * Get entity ID
   */
  getId(): Identifier {
    return this.id;
  }

  /**
   * Get entity version (for optimistic locking)
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Increment version (called by repository on save)
   */
  incrementVersion(): void {
    this.version++;
  }

  /**
   * Check equality with another entity
   * Entities are equal if they have the same ID
   */
  equals(object?: Entity<T>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (!(object instanceof Entity)) {
      return false;
    }

    return this.id.equals(object.id);
  }

  /**
   * Get a specific property value
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.props[key];
  }

  /**
   * Check if entity has pending domain events
   */
  hasDomainEvents(): boolean {
    return this.domainEvents.length > 0;
  }

  /**
   * Get all pending domain events
   */
  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  /**
   * Add a domain event to be dispatched
   */
  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  /**
   * Clear domain events after dispatch
   */
  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  /**
   * Convert entity to plain object (for persistence/serialization)
   * Override in subclasses to customize
   */
  toJSON(): object {
    return {
      id: this.id.toString(),
      ...this.props,
      version: this.version,
    };
  }

  /**
   * Validate entity state
   * Override to implement invariant checks
   */
  abstract validate(): void;
}
