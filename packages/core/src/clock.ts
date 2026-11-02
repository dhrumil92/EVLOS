// Milliseconds since 1970-01-01T00:00:00Z. A plain number keeps the core free of Date.
export type Instant = number;

// The only way a rule may learn the time. Tests supply a fixed one.
export interface Clock {
  now(): Instant;
}
