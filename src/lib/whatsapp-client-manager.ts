/**
 * @fileoverview Manages the state of active WhatsApp client connections.
 * This is a server-side in-memory store. It will be reset on server restarts.
 * A more robust solution for production might involve a database or a shared cache like Redis.
 */
import { type Client } from 'whatsapp-web.js';

const activeClients = new Map<string, Client>();

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
 * Deletes the client instance for a given user ID and destroys the connection.
 * @param userId The user's unique ID.
 */
export async function deleteClient(userId: string): Promise<void> {
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
