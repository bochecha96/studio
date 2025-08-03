'use server';
/**
 * @fileOverview A flow for manually resending messages to pending contacts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessage, type Contact } from './sendMessage-flow';
import { Client, LocalAuth } from 'whatsapp-web.js';
import path from 'path';

const ResendMessagesInputSchema = z.object({
  userId: z.string(),
});
export type ResendMessagesInput = z.infer<typeof ResendMessagesInputSchema>;

async function fetchPendingContacts(userId: string): Promise<Contact[]> {
  try {
    console.log(`Fetching pending contacts for userId: ${userId}`);
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
    console.log(`Found ${contacts.length} pending contacts.`);
    return contacts;
  } catch (error) {
    console.error("Error fetching pending contacts:", error);
    return [];
  }
}

export async function resendMessages(input: ResendMessagesInput): Promise<{success: boolean, message: string, count: number}> {
  return resendMessagesFlow(input);
}


const resendMessagesFlow = ai.defineFlow(
  {
    name: 'resendMessagesFlow',
    inputSchema: ResendMessagesInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        count: z.number(),
    }),
  },
  async ({ userId }) => {
    let client: Client | null = null;
    try {
      console.log(`Initializing client to resend messages for user ${userId}.`);
      
      client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.resolve(process.cwd(), `.wweb_auth_${userId}`) }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      });

      const readyPromise = new Promise<void>((resolve, reject) => {
        client!.once('ready', () => {
            console.log("Client is ready for resending.");
            resolve();
        });
        client!.once('auth_failure', (msg) => reject(new Error(`Authentication failure: ${msg}`)));
        client!.once('disconnected', (reason) => reject(new Error(`Client disconnected: ${reason}`)));
      });

      console.log("Initializing client...");
      await client.initialize();
      
      console.log("Waiting for client to be ready...");
      await readyPromise;
      
      console.log("Client is ready. Fetching contacts to resend.");
      const pendingContacts = await fetchPendingContacts(userId);

      if (pendingContacts.length > 0) {
        console.log(`Found ${pendingContacts.length} contacts. Starting message sending process.`);
        await sendMessage({ contacts: pendingContacts, client });
        console.log("Finished sending messages.");
        return { success: true, message: `Mensagens enviadas para ${pendingContacts.length} contatos pendentes.`, count: pendingContacts.length };
      } else {
        console.log("No pending contacts to message.");
        return { success: true, message: "Nenhum contato pendente encontrado para enviar mensagens.", count: 0 };
      }
    } catch (error: any) {
      console.error("Error in resendMessagesFlow:", error);
      return { success: false, message: error.message || 'Falha ao reenviar mensagens. Você está conectado?', count: 0 };
    } finally {
        if (client) {
            console.log("Destroying resend client...");
            await client.destroy();
            console.log("Resend client destroyed.");
        }
    }
  }
);
