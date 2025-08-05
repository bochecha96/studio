'use server';
/**
 * @fileOverview A flow for manually resending messages to pending contacts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { sendNewContacts } from './sendNewContacts-flow';

const ResendMessagesInputSchema = z.object({
  userId: z.string(),
});
export type ResendMessagesInput = z.infer<typeof ResendMessagesInputSchema>;

// This schema is defined here because it's used by this flow's output
// and it cannot be exported from a 'use server' file.
const SendNewContactsOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    count: z.number(),
});


export async function resendMessages(input: ResendMessagesInput): Promise<z.infer<typeof SendNewContactsOutputSchema>> {
  return resendMessagesFlow(input);
}

const resendMessagesFlow = ai.defineFlow(
  {
    name: 'resendMessagesFlow',
    inputSchema: ResendMessagesInputSchema,
    outputSchema: SendNewContactsOutputSchema,
  },
  async ({ userId }) => {
     try {
        console.log(`Manually triggering resend for user ${userId}.`);

        // Delegate to the main sending flow.
        const result = await sendNewContacts({ userId });
        
        // Customize the message for the manual trigger context
        if (result.success) {
             if (result.count > 0) {
                 return { success: true, message: `Mensagens enviadas para ${result.count} contatos pendentes.`, count: result.count };
             } else {
                 return { success: true, message: "Nenhum contato pendente encontrado para enviar mensagens.", count: 0 };
             }
        } else {
            // Add a more specific error message if connection failed
            if (result.message.includes("Authentication failure")) {
                 return { success: false, message: "Não é possível enviar mensagens. O WhatsApp não está conectado. Por favor, vá para as Configurações para conectar.", count: 0 };
            }
            return result; // Propagate the error message from the sendNewContacts flow
        }

    } catch (error: any) {
      console.error("Error in resendMessagesFlow:", error);
      return { success: false, message: error.message || 'Falha ao reenviar mensagens.', count: 0 };
    }
  }
);
