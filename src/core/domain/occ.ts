/**
 * @fileoverview Optimistic Concurrency Control (OCC) Engine
 * Conforms to Requirement 3.1.2 & 3.3.1 for Firestore / Local version locking
 */

export class ConcurrencyConflictError extends Error {
  public readonly entityId: string;
  public readonly expectedVersion: number;
  public readonly currentVersion: number;

  constructor(entityId: string, expectedVersion: number, currentVersion: number) {
    super(
      `[OCC Conflict] Concurrency conflict detected on entity ${entityId}. Expected version ${expectedVersion}, but found version ${currentVersion}.`
    );
    this.name = 'ConcurrencyConflictError';
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}

export interface VersionedEntity {
  id: string;
  version?: number;
  updatedAt?: number;
}

/**
 * Validates and increments an entity version using OCC semantics
 */
export function validateAndIncrementVersion<T extends VersionedEntity>(
  current: T,
  incoming: Partial<T> & { expectedVersion?: number },
  autoIncrement = true
): { updated: T; newVersion: number } {
  const currentVer = current.version ?? 1;
  const expectedVer = incoming.expectedVersion ?? incoming.version ?? currentVer;

  if (expectedVer !== currentVer) {
    throw new ConcurrencyConflictError(current.id, expectedVer, currentVer);
  }

  const newVersion = autoIncrement ? currentVer + 1 : currentVer;
  const updated: T = {
    ...current,
    ...incoming,
    version: newVersion,
    updatedAt: Date.now(),
  };

  return { updated, newVersion };
}

export interface OccRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Executes a mutation with automatic retries when ConcurrencyConflictError occurs
 * @param fetchLatest Function returning the fresh state of the entity
 * @param mutate Mutation callback receiving latest entity and persisting changes
 * @param options Retry policy options
 */
export async function withOccRetry<T extends VersionedEntity, R>(
  fetchLatest: () => Promise<T | null>,
  mutate: (latest: T) => Promise<R>,
  options: OccRetryOptions = {}
): Promise<R> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.initialDelayMs ?? 50;
  const backoff = options.backoffFactor ?? 1.5;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const latest = await fetchLatest();
    if (!latest) {
      throw new Error('[OCC Retry] Target entity could not be found for mutation');
    }
    try {
      return await mutate(latest);
    } catch (err) {
      if (err instanceof ConcurrencyConflictError && attempt < maxRetries) {
        lastError = err;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= backoff;
        }
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

