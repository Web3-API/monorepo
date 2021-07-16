import { Uri } from "./Uri";
import { QueryApiOptions, QueryApiResult } from "./Query";

/** Defines the frequency of API invocations for an API subscription */
export interface SubscriptionFrequency {
  ms?: number;
  sec?: number;
  min?: number;
  hours?: number;
}

/** Options required for an API subscription. */
export interface SubscribeOptions<
  TVariables extends Record<string, unknown> = Record<string, unknown>,
  TUri = Uri
> extends QueryApiOptions<TVariables, TUri> {
  /**
   * The frequency of API invocations. Defaults to one query per minute.
   */
  frequency?: SubscriptionFrequency;
}

/**
 * An API subscription, which implements the AsyncIterator protocol, is an
 * AsyncIterable that yields query results at a specified frequency.
 * @template TData Type of the query result.
 */
export interface Subscription<
  TData extends Record<string, unknown> = Record<string, unknown>
> {
  /**
   * The frequency of API invocations.
   */
  frequency: number;
  /**
   * Indicates whether the subscription is currently active.
   */
  isActive: boolean;
  /**
   * Stops subscription. If a query has been called but has not yet returned,
   * that query will be completed and its result will be yielded.
   */
  stop(): void;
  /**
   * Implementation of AsyncIterator protocol makes the Subscription an
   * AsyncIterable, allowing use in for await...of loops.
   */
  [Symbol.asyncIterator](): AsyncGenerator<QueryApiResult<TData>>;
}
