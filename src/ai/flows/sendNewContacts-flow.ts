'use server';
/**
 * @fileOverview A dedicated flow for sending messages to new/pending contacts.
 * This flow is designed to be called automatically after a webhook or manually.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessage, type Contact } from './sendMessage-flow';
import { Client } from 'whatsapp-web.js';

// In-memory store for active clients, mapping userId to Client instance.
const activeClients = new Map<string, Client>();

/**
 * Sets or replaces the active client for a given user.
 * @param userId The user's ID.
 * @param client The authenticated client instance.
 */
export async function setActiveClient(userId: string, client: Client): Promise<void> {
    // If there's an old client for this user, destroy it first.
    if (activeClients.has(userId)) {
        console.log(`Replacing existing client for user ${userId}.`);
        activeClients.get(userId)?.destroy().catch(e => console.error("Error destroying old client:", e));
    }
    console.log(`Setting active client for user ${userId}.`);
    activeClients.set(userId, client);

    // Monitor for disconnection
    client.once('disconnected', () => {
        console.log(`Client for user ${userId} disconnected, removing from active clients.`);
        clearActiveClient(userId);
    });
}

/**
 * Clears the active client for a user, optionally destroying it.
 * @param userId The user's ID.
 * @param destroy Whether to call the client's destroy method.
 */
export async function clearActiveClient(userId: string, destroy: boolean = true): Promise<void> {
    if (activeClients.has(userId)) {
        const client = activeClients.get(userId)!;
        console.log(`Clearing active client for user ${userId}. Destroy: ${destroy}`);
        activeClients.delete(userId);
        if (destroy && client.pupBrowser) {
            try {
                await client.destroy();
                console.log(`Client for user ${userId} destroyed.`);
            } catch (e) {
                console.error(`Error destroying client for ${userId}:`, e);
            }
        }
    }
}

/**
 * Checks the connection status of a user's client.
 * @param userId The user's ID.
 * @returns 'connected' | 'disconnected'
 */
export async function getClientStatus(userId: string): Promise<'connected' | 'disconnected'> {
    return activeClients.has(userId) ? 'connected' : 'disconnected';
}


const SendNewContactsInputSchema = z.object({
  userId: z.string(),
});
export type SendNewContactsInput = z.infer<typeof SendNewContactsInputSchema>;

const SendNewContactsOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    count: z.number(),
});
export type SendNewContactsOutput = z.infer<typeof SendNewContactsOutputSchema>;

async function fetchPendingContacts(userId: string): Promise<Contact[]> {
  try {
    const q = query(collection(db, 'contacts'), where('userId', '==', userId), where('status', '==', 'Pendente'));
    const querySnapshot = await getDocs(q);
    const contacts: Contact[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      contacts.push({
        id: doc.id,
        name: data.name,
        phone: data.phone,
        product: data.product,
        userId: data.userId
      });
    });
    return contacts;
  } catch (error) {
    console.error("Error fetching pending contacts:", error);
    return [];
  }
}

export async function sendNewContacts(input: SendNewContactsInput): Promise<SendNewContactsOutput> {
  return sendNewContactsFlow(input);
}


const sendNewContactsFlow = ai.defineFlow(
  {
    name: 'sendNewContactsFlow',
    inputSchema: SendNewContactsInputSchema,
    outputSchema: SendNewContactsOutputSchema,
  },
  async ({ userId }) => {
    // Check if there is a globally stored, ready-to-use client for this user.
    const client = activeClients.get(userId);

    if (!client) {
        console.log(`No active client found for user ${userId}. Cannot send messages.`);
        // It's not an "error" state, just that we can't do the work right now.
        // The message will be sent when the user next connects.
        return { success: true, message: "WhatsApp não está conectado. As mensagens serão enviadas na próxima conexão.", count: 0 };
    }
    
    // Check if client is actually ready to send messages
    try {
        const clientState = await client.getState();
        if (clientState !== 'CONNECTED') {
             console.log(`Client for user ${userId} exists but is not in a connected state (${clientState}).`);
             return { success: false, message: `O cliente não está conectado (status: ${clientState}).`, count: 0 };
        }
    } catch(e) {
        console.error(`Error getting client state for user ${userId}:`, e);
        return { success: false, message: "Erro ao verificar o status do cliente do WhatsApp.", count: 0 };
    }


    try {
      console.log(`Client is ready. Fetching contacts to send for user ${userId}.`);
      const pendingContacts = await fetchPendingContacts(userId);

      if (pendingContacts.length > 0) {
        console.log(`Found ${pendingContacts.length} pending contacts for ${userId}. Starting message sending process.`);
        await sendMessage({ contacts: pendingContacts, client });
        console.log(`Finished sending messages for user ${userId}.`);
        return { success: true, message: `Mensagens enviadas para ${pendingContacts.length} contatos pendentes.`, count: pendingContacts.length };
      } else {
        console.log(`No pending contacts to message for user ${userId}.`);
        return { success: true, message: "Nenhum contato pendente encontrado.", count: 0 };
      }
    } catch (error: any) {
      console.error(`Error in sendNewContactsFlow for user ${userId}:`, error);
      return { success: false, message: error.message || 'Falha ao enviar novas mensagens.', count: 0 };
    }
  }
);
