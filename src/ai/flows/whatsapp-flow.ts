'use server';
/**
 * @fileOverview A flow for handling WhatsApp Web connections.
 * This flow now manages the QR code generation and long-lived connection
 * for receiving messages and supports sending messages via a managed client.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { type Message, type Client } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendNewContacts } from './sendNewContacts-flow';
import { setClient, deleteClient, getClient, getClientStatus } from '@/lib/whatsapp-client-manager';
import { generateAnswer } from './generateAnswer-flow';


const GenerateQrCodeInputSchema = z.object({
    userId: z.string().describe("The ID of the user initiating the connection."),
});
export type GenerateQrCodeInput = z.infer<typeof GenerateQrCodeInputSchema>;

const GenerateQrCodeOutputSchema = z.object({
  qr: z.string().optional().describe("The QR code as a data URI."),
  status: z.string().describe("The connection status."),
  message: z.string().optional().describe("An optional message about the status.")
});
export type GenerateQrCodeOutput = z.infer<typeof GenerateQrCodeOutputSchema>;

const ClientStatusInputSchema = z.object({
  userId: z.string(),
});
export type ClientStatusInput = z.infer<typeof ClientStatusInputSchema>;

const ClientStatusOutputSchema = z.object({
  status: z.string(),
});
export type ClientStatusOutput = z.infer<typeof ClientStatusOutputSchema>;


async function handleIncomingMessage(message: Message, userId: string, client: Client) {
    try {
        const chatId = message.from;
        const phone = chatId.split('@')[0];
        console.log(`New message from ${phone} for user ${userId}: "${message.body}"`);

        // Find the contact by phone number for the specific user
        const q = query(
            collection(db, 'contacts'),
            where('userId', '==', userId),
            where('phone', '==', phone),
            where('status', 'in', ['Contatado', 'Respondido']) // Act on contacts we've messaged or already replied to
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log(`No 'Contatado' or 'Respondido' contact found for ${phone} and user ${userId}. Ignoring.`);
            return;
        }

        // Assuming one contact per phone number for a user
        const contactDoc = querySnapshot.docs[0];
        const contactData = contactDoc.data();
        
        console.log(`Contact ${contactDoc.id} (${contactData.name}) replied. Generating AI response.`);

        // 1. Generate the AI-powered answer
        const aiResponse = await generateAnswer({
            customerName: contactData.name,
            productName: contactData.product,
            message: message.body
        });
        
        // 2. Send the AI response back to the user
        if (aiResponse.answer) {
             console.log(`Sending AI response to ${chatId}: "${aiResponse.answer}"`);
             await client.sendMessage(chatId, aiResponse.answer);
        } else {
            console.error(`AI failed to generate an answer for contact ${contactDoc.id}.`);
        }

        // 3. Update the contact status to 'Respondido'
        const contactRef = doc(db, 'contacts', contactDoc.id);
        await updateDoc(contactRef, {
            status: 'Respondido'
        });
        console.log(`Status for contact ${contactDoc.id} updated to 'Respondido'.`);


    } catch (error) {
        console.error("Error handling incoming message:", error);
    }
}

export async function generateQrCode(input: GenerateQrCodeInput): Promise<GenerateQrCodeOutput> {
  return generateQrCodeFlow(input);
}


const generateQrCodeFlow = ai.defineFlow(
  {
    name: 'generateQrCodeFlow',
    inputSchema: GenerateQrCodeInputSchema,
    outputSchema: GenerateQrCodeOutputSchema,
  },
  async ({ userId }) => {
    
    console.log(`Initializing client with local auth for user ${userId}.`);

    if (getClientStatus(userId) === 'connected') {
        console.log(`User ${userId} is already connected.`);
        return { status: 'connected', message: 'Já conectado.' };
    }
    
    // Dynamically import 'whatsapp-web.js'
    const { Client, LocalAuth } = await import('whatsapp-web.js');

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: `.wweb_auth_${userId}` }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', 
            '--disable-gpu'
          ],
        },
      });

    const promise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
        
        client.on('qr', async (qr) => {
            console.log(`QR RECEIVED for ${userId}.`);
            try {
                const qrCodeDataUri = await qrcode.toDataURL(qr);
                resolve({ qr: qrCodeDataUri, status: 'pending_qr' });
            } catch (err) {
                console.error("Failed to generate QR code data URI:", err);
                reject(new Error("Failed to generate QR code data URI."));
            }
        });

        client.on('ready', () => {
            console.log(`Client for ${userId} is ready! Setting up for message receiving.`);
            setClient(userId, client);
            
            client.on('message', (message) => handleIncomingMessage(message, userId, client));
            
            sendNewContacts({ userId }).catch(error => {
                console.error(`Error during initial sendNewContacts for user ${userId}:`, error);
            });
            
            resolve({ status: 'connected', message: 'WhatsApp conectado com sucesso.' });
        });
        
        client.on('auth_failure', (msg) => {
          console.error(`AUTHENTICATION FAILURE for ${userId}:`, msg);
          deleteClient(userId);
          reject(new Error('Falha na autenticação. Por favor, gere um novo QR Code.'));
        });

        client.on('disconnected', (reason) => {
          console.log(`Client for ${userId} was logged out:`, reason);
          deleteClient(userId);
        });

        client.initialize().catch(err => {
            console.error(`Client initialization error for ${userId}:`, err);
            reject(new Error("Failed to initialize WhatsApp client."));
        });
    });

    return promise;
  }
);


const clearClientInputSchema = z.object({
    userId: z.string(),
});
export type ClearClientInput = z.infer<typeof clearClientInputSchema>;

export async function clearActiveClient(input: ClearClientInput): Promise<void> {
    return clearActiveClientFlow(input);
}

const clearActiveClientFlow = ai.defineFlow(
    {
        name: 'clearActiveClientFlow',
        inputSchema: clearClientInputSchema,
    },
    async ({ userId }) => {
        console.log(`Received request to clear active client for user ${userId}.`);
        await deleteClient(userId);
    }
);

export async function checkClientStatus(input: ClientStatusInput): Promise<ClientStatusOutput> {
    return checkClientStatusFlow(input);
}

const checkClientStatusFlow = ai.defineFlow(
    {
        name: 'checkClientStatusFlow',
        inputSchema: ClientStatusInputSchema,
        outputSchema: ClientStatusOutputSchema,
    },
    async ({ userId }) => {
        const status = getClientStatus(userId);
        return { status };
    }
);
