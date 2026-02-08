import { v4 as uuidv4, validate as validateUUID } from 'uuid';

export class Identifier {
  private readonly value: string;

  constructor(id?: string) {
    this.value = id ? id : uuidv4();

    if (!validateUUID(this.value)) {
      throw new Error('Invalid UUID format');
    }
  }

  //Returns the string representation of the identifier
  toString(): string {
    return this.value;
  }

  //Returns the row value of the identifier
  getValue(): string {
    return this.value;
  }

  /**
   * Equality comparison based on value, not reference
   */
  equals(id: Identifier): boolean {
    if (!(id instanceof Identifier)) {
      return false;
    }

    return this.value === id.toString();
  }

  /**
   * Check if string is a valid UUID before creating
   */
  static validate(id: string): boolean {
    return validateUUID(id);
  }

  /**
   * Create from string with validation
   */
  static fromString(id: string): Identifier {
    return new Identifier(id);
  }

  /**
   * Generate a new random identifier
   */
  static generate(): Identifier {
    return new Identifier();
  }
}
