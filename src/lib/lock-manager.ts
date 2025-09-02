/**
 * @fileoverview Manages a simple in-memory locking mechanism to prevent concurrent operations for the same user.
 * This is crucial for resource-intensive, asynchronous tasks like the WhatsApp client initialization.
 */

// A Set is used to store the user IDs of currently active (locked) operations.
const lockedUserIds = new Set<string>();

/**
 * Attempts to acquire a lock for a specific user ID.
 * @param userId The unique identifier for the user.
 * @returns {boolean} True if the lock was successfully acquired, false if the user is already locked.
 */
export function acquireLock(userId: string): boolean {
  if (lockedUserIds.has(userId)) {
    // If the user ID is already in the set, the operation is locked.
    console.log(`Lock acquisition failed for user ${userId}: already locked.`);
    return false;
  }
  // If not locked, add the user ID to the set and confirm success.
  lockedUserIds.add(userId);
  console.log(`Lock acquired for user ${userId}.`);
  return true;
}

/**
 * Releases the lock for a specific user ID.
 * @param userId The unique identifier for the user.
 */
export function releaseLock(userId: string): void {
  if (lockedUserIds.has(userId)) {
    lockedUserIds.delete(userId);
    console.log(`Lock released for user ${userId}.`);
  }
}

/**
 * Checks if a user ID is currently locked.
 * @param userId The unique identifier for the user.
 * @returns {boolean} True if the user is locked, false otherwise.
 */
export function isLocked(userId: string): boolean {
  return lockedUserIds.has(userId);
}
