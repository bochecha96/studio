'use server';
/**
 * @fileOverview A dedicated flow for sending messages to new/pending contacts.
 * This flow now uses a long-lived client connection managed by the ClientManager.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessage, type Contact } from './sendMessage-flow';
import { getClient } from '@/lib/whatsapp-client-manager';

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
    
    const client = getClient(userId);

    if (!client) {
        const errorMessage = "Não é possível enviar mensagens. O WhatsApp não está conectado. Por favor, vá para as Configurações para conectar.";
        console.warn(errorMessage);
        return { success: false, message: errorMessage, count: 0 };
    }
      
    try {
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
    }
  }
);
