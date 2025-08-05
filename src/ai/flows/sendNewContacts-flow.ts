'use server';
/**
 * @fileOverview A dedicated flow for sending messages to new/pending contacts.
 * This flow now establishes a temporary connection to send messages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessage, type Contact } from './sendMessage-flow';
import { Client, LocalAuth } from 'whatsapp-web.js';
import path from 'path';

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
    console.log(`Starting sendNewContactsFlow for user ${userId}.`);

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.resolve(process.cwd(), `.wweb_auth_${userId}`) }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      });
      
    try {
        const readyPromise = new Promise<void>((resolve, reject) => {
             // Set a timeout for the ready event
            const timeoutId = setTimeout(() => {
                reject(new Error('Authentication failure: Client took too long to get ready.'));
            }, 60000); // 60 seconds timeout

            client.once('ready', () => {
                clearTimeout(timeoutId);
                console.log(`Client for ${userId} is ready for sending.`);
                resolve();
            });

            client.once('auth_failure', (msg) => {
                clearTimeout(timeoutId);
                console.error(`AUTHENTICATION FAILURE for ${userId} in send flow:`, msg);
                reject(new Error('Authentication failure. Please re-authenticate via Settings.'));
            });

             client.initialize().catch(reject);
        });

        await readyPromise;
        
      console.log(`Client is ready. Fetching contacts to send for user ${userId}.`);
      const pendingContacts = await fetchPendingContacts(userId);

      if (pendingContacts.length > 0) {
        console.log(`Found ${pendingContacts.length} pending contacts for ${userId}. Starting message sending process.`);
        await sendMessage(pendingContacts, client);
        console.log(`Finished sending messages for user ${userId}.`);
        return { success: true, message: `Mensagens enviadas para ${pendingContacts.length} contatos pendentes.`, count: pendingContacts.length };
      } else {
        console.log(`No pending contacts to message for user ${userId}.`);
        return { success: true, message: "Nenhum contato pendente encontrado.", count: 0 };
      }
    } catch (error: any) {
      console.error(`Error in sendNewContactsFlow for user ${userId}:`, error);
      return { success: false, message: error.message || 'Falha ao enviar novas mensagens.', count: 0 };
    } finally {
        // Ensure client is destroyed after operation
        if (client.pupBrowser) {
             console.log(`Destroying client for user ${userId} after send flow.`);
             await client.destroy();
        }
    }
  }
);