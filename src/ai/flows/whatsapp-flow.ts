'use server';
/**
 * @fileOverview A flow for handling WhatsApp Web connections.
 * This flow now only manages the QR code generation and long-lived connection
 * for receiving messages. Sending is handled by a separate, on-demand flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendNewContacts } from './sendNewContacts-flow';

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


async function handleIncomingMessage(message: any, userId: string) {
    try {
        const chatId = message.from;
        const phone = chatId.split('@')[0];
        console.log(`New message from ${phone} for user ${userId}: "${message.body}"`);

        // Find the contact by phone number for the specific user
        const q = query(
            collection(db, 'contacts'),
            where('userId', '==', userId),
            where('phone', '==', phone),
            where('status', '==', 'Contatado') // Only act on contacts we've already messaged
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log(`No 'Contatado' contact found for ${phone} and user ${userId}. Ignoring.`);
            return;
        }

        querySnapshot.forEach(async (docSnapshot) => {
            console.log(`Contact ${docSnapshot.id} (${docSnapshot.data().name}) replied. Updating status.`);
            const contactRef = doc(db, 'contacts', docSnapshot.id);
            await updateDoc(contactRef, {
                status: 'Respondido'
            });
            console.log(`Status for contact ${docSnapshot.id} updated to 'Respondido'.`);
        });

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
    
    console.log(`Initializing client with puppeteer config for user ${userId}.`);

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

    return new Promise((resolve, reject) => {
        client.on('qr', async (qr) => {
            console.log(`QR RECEIVED for ${userId}.`);
            try {
                const qrCodeDataUri = await qrcode.toDataURL(qr);
                resolve({ qr: qrCodeDataUri, status: 'pending' });
            } catch (err) {
                console.error("Failed to generate QR code data URI:", err);
                reject(new Error("Failed to generate QR code data URI."));
            }
        });

        client.on('ready', () => {
            console.log(`Client for ${userId} is ready! Setting up for message receiving.`);
            client.on('message', (message) => handleIncomingMessage(message, userId));
            
            // Trigger an initial send on successful connection
            sendNewContacts({ userId }).catch(error => {
                console.error(`Error during initial sendNewContacts for user ${userId}:`, error);
            });
            
            resolve({ status: 'authenticated', message: 'Já conectado.' });
        });
        
        client.on('auth_failure', (msg) => {
          console.error(`AUTHENTICATION FAILURE for ${userId}:`, msg);
          client.destroy().catch(() => {});
          reject(new Error('Falha na autenticação. Por favor, gere um novo QR Code.'));
        });

        client.on('disconnected', (reason) => {
          console.log(`Client for ${userId} was logged out:`, reason);
          client.destroy().catch(() => {});
          reject(new Error(`Cliente desconectado: ${reason}`));
        });

        client.initialize().catch(err => {
            console.error('Client initialization error:', err);
            client.destroy().catch(() => {});
            reject(new Error("Failed to initialize WhatsApp client."));
        });
    });
  }
);
