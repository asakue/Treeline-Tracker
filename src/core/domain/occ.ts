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
