'use server';
/**
 * @fileOverview A flow for sending WhatsApp messages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client } from 'whatsapp-web.js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ContactSchema = z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().optional(),
    product: z.string(),
    userId: z.string(),
});

const SendMessageInputSchema = z.object({
  contacts: z.array(ContactSchema),
  client: z.any().describe("The authenticated whatsapp-web.js client instance."),
});

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export async function sendMessage(input: SendMessageInput): Promise<void> {
  await sendMessageFlow(input);
}

export const sendMessageFlow = ai.defineFlow(
  {
    name: 'sendMessageFlow',
    inputSchema: SendMessageInputSchema,
    outputSchema: z.void(),
  },
  async ({ contacts, client }) => {
    console.log(`Received ${contacts.length} contacts to message.`);
    
    for (const contact of contacts) {
      if (contact.phone) {
        // Format phone number for whatsapp-web.js (e.g., 5511999999999@c.us)
        const sanitizedPhone = contact.phone.replace(/[^0-9]/g, '');
        const chatId = `${sanitizedPhone}@c.us`;
        const message = `Oi, ${contact.name}, desistiu do seu ${contact.product}?`;
        
        try {
          console.log(`Sending message to ${chatId}: "${message}"`);
          const whatsappClient = client as Client;
          await whatsappClient.sendMessage(chatId, message);
          
          // Update contact status to 'Contatado' in Firestore
          const contactRef = doc(db, 'contacts', contact.id);
          await updateDoc(contactRef, {
            status: 'Contatado'
          });
          
          console.log(`Successfully sent message and updated status for contact ${contact.id}`);
        } catch (error) {
          console.error(`Failed to send message or update status for contact ${contact.id} (${contact.name}) at ${chatId}:`, error);
        }
      } else {
        console.log(`Skipping contact ${contact.name} (ID: ${contact.id}) due to missing phone number.`);
      }
    }
  }
);
