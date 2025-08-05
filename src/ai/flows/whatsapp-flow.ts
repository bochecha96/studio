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

// In-memory store for active, long-lived clients for receiving messages.
const activeClients = new Map<string, Client>();

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

// Function to check connection status without exporting it as a server action
async function getClientStatus(userId: string): Promise<'connected' | 'disconnected'> {
    return activeClients.has(userId) ? 'connected' : 'disconnected';
}

// Function to clear client session
export async function clearActiveClient(userId: string): Promise<void> {
    if (activeClients.has(userId)) {
        const client = activeClients.get(userId)!;
        console.log(`Clearing active client for ${userId}.`);
        activeClients.delete(userId);
        client.removeListener('message', handleIncomingMessage);
        if (client.pupBrowser) {
            try {
                await client.destroy();
                console.log(`Client for user ${userId} destroyed.`);
            } catch (e) {
                console.error(`Error destroying client for ${userId}:`, e);
            }
        }
    }
}

const generateQrCodeFlow = ai.defineFlow(
  {
    name: 'generateQrCodeFlow',
    inputSchema: GenerateQrCodeInputSchema,
    outputSchema: GenerateQrCodeOutputSchema,
  },
  async ({ userId }) => {
    
    if (await getClientStatus(userId) === 'connected') {
        console.log(`User ${userId} is already connected.`);
        return { status: 'authenticated', message: 'Já conectado.' };
    }
    
    // If there is any other client active for this user, destroy it before creating a new one.
    await clearActiveClient(userId);
      
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

    try {
      const connectionPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
        const QR_CODE_TIMEOUT = 70000;
        const timeoutId = setTimeout(() => {
          cleanupListeners();
          reject(new Error('Timeout: A conexão demorou muito. Por favor, tente novamente.'));
        }, QR_CODE_TIMEOUT);

        const cleanupListeners = () => {
            clearTimeout(timeoutId);
            client.removeListener('qr', handleQrCode);
            client.removeListener('ready', handleClientReady);
            client.removeListener('auth_failure', handleAuthenticationFailure);
            client.removeListener('disconnected', handleDisconnected);
        };

        const handleAuthenticationFailure = async (msg: string) => {
          console.error(`AUTHENTICATION FAILURE for ${userId}:`, msg);
          cleanupListeners();
          await clearActiveClient(userId);
          reject(new Error('Falha na autenticação. Por favor, gere um novo QR Code.'));
        };

        const handleClientReady = async () => {
          console.log(`Client for ${userId} is ready! Setting up for message receiving.`);
          
          // Set up the long-lived listener for incoming messages
          client.on('message', (message) => handleIncomingMessage(message, userId));
          
          activeClients.set(userId, client);

          cleanupListeners();
          
          // Trigger the flow to send messages to any existing pending contacts.
          sendNewContacts({ userId }).catch(error => {
              console.error(`Error during initial sendNewContacts for user ${userId}:`, error);
          });
          
          resolve({ status: 'authenticated' });
        };

        const handleDisconnected = async (reason: any) => {
          console.log(`Client for ${userId} was logged out:`, reason);
          cleanupListeners();
          await clearActiveClient(userId);
          reject(new Error(`Cliente desconectado: ${reason}`));
        };

        const handleQrCode = async (qr: string) => {
          console.log(`QR RECEIVED for ${userId}.`);
          try {
            const qrCodeDataUri = await qrcode.toDataURL(qr);
            // QR code is available, but we continue waiting for 'ready' or 'auth_failure'
            resolve({ qr: qrCodeDataUri, status: 'pending' });
          } catch (err) {
            cleanupListeners();
            reject(err);
          }
        };
        
        client.once('qr', handleQrCode);
        client.once('ready', handleClientReady);
        client.once('auth_failure', handleAuthenticationFailure);
        client.once('disconnected', handleDisconnected);
      });
      
      console.log(`Initializing WhatsApp client for ${userId}...`);
      client.initialize().catch(error => {
          console.error(`Client initialization failed for ${userId}:`, error);
      });

      return await connectionPromise;

    } catch (error) {
        console.error(`Flow error for user ${userId}:`, error);
        await clearActiveClient(userId);
        throw error; 
    }
  }
);