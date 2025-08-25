/**
 * @fileoverview Manages the state of active WhatsApp client connections.
 * This is a server-side in-memory store. It will be reset on server restarts.
 * A more robust solution for production might involve a database or a shared cache like Redis.
 */
import { type Client } from 'whatsapp-web.js';

const activeClients = new Map<string, Client>();
const intervalTrackers = new Map<string, NodeJS.Timeout>();

/**
 * Stores an active client instance for a given user ID.
 * @param userId The user's unique ID.
 * @param client The active whatsapp-web.js client instance.
 */
export function setClient(userId: string, client: Client): void {
    activeClients.set(userId, client);
    console.log(`Client stored for user ${userId}. Total active clients: ${activeClients.size}`);
}

/**
 * Retrieves the active client instance for a given user ID.
 * @param userId The user's unique ID.
 * @returns The client instance or undefined if not found.
 */
export function getClient(userId: string): Client | undefined {
    return activeClients.get(userId);
}

/**
 * Retrieves all active clients.
 * @returns A map of all active clients with their user IDs.
 */
export function getAllClients(): Map<string, Client> {
    return activeClients;
}


/**
 * Deletes the client instance for a given user ID and destroys the connection.
 * @param userId The user's unique ID.
 */
export async function deleteClient(userId: string): Promise<void> {
    // Stop any associated interval first
    stopSendingInterval(userId);

    const client = activeClients.get(userId);
    if (client) {
        try {
            await client.destroy();
            console.log(`Client for user ${userId} destroyed.`);
        } catch (error) {
            console.error(`Error destroying client for user ${userId}:`, error);
        } finally {
            activeClients.delete(userId);
            console.log(`Client deleted for user ${userId}. Total active clients: ${activeClients.size}`);
        }
    } else {
        console.log(`No active client to delete for user ${userId}.`);
    }
}

/**
 * Gets the connection status for a given user.
 * @param userId The user's unique ID.
 * @returns A string representing the status ('connected' or 'disconnected').
 */
export function getClientStatus(userId: string): 'connected' | 'disconnected' {
    return activeClients.has(userId) ? 'connected' : 'disconnected';
}


/**
 * Stores the interval ID for a user's periodic task.
 * @param userId The user's unique ID.
 * @param intervalId The ID of the setInterval timer.
 */
export function startSendingInterval(userId: string, intervalId: NodeJS.Timeout): void {
    // If an old interval exists, clear it before setting a new one.
    if (intervalTrackers.has(userId)) {
        stopSendingInterval(userId);
    }
    intervalTrackers.set(userId, intervalId);
    console.log(`Interval tracking started for user ${userId}.`);
}

/**
 * Stops the periodic task for a user.
 * @param userId The user's unique ID.
 */
export function stopSendingInterval(userId: string): void {
    if (intervalTrackers.has(userId)) {
        clearInterval(intervalTrackers.get(userId)!);
        intervalTrackers.delete(userId);
        console.log(`Interval tracking stopped for user ${userId}.`);
    }
}

    