export interface IDomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredOn: Date;
  version: number;
}

/**
 * Abstract base class for domain events.
 * All domain events must extend this class.
 */
export abstract class DomainEvent implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly version: number = 1;

  protected constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    version?: number
  ) {
    this.eventId = this.generateEventId();
    this.occurredOn = new Date();
    if (version) {
      this.version = version;
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serialize event to JSON for persistence or transport
   */
  toJSON(): object {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      occurredOn: this.occurredOn.toISOString(),
      version: this.version,
      ...this.getEventPayload(),
    };
  }

  /**
   * Override to provide event-specific payload
   */
  protected abstract getEventPayload(): object;
}

/**
 * Marker interface for event handlers
 */
export interface IDomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * Event bus interface for publishing domain events
 */
export interface IEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: IDomainEventHandler<T>): void;
}
