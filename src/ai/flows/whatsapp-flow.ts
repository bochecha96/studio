'use server';
/**
 * @fileOverview A flow for handling WhatsApp Web connections.
 *
 * - generateQrCode - Generates a QR code for WhatsApp Web authentication.
 * - GenerateQrCodeInput - The input type for the generateQrCode function.
 * - GenerateQrCodeOutput - The return type for the generateQrCode function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { setActiveClient, clearActiveClient, sendNewContacts, getClientStatus } from './sendNewContacts-flow';


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

const QR_CODE_TIMEOUT = 70000;


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
    let timeoutId: NodeJS.Timeout | undefined;
    
    // If a client is already connected and authenticated for this user, don't create a new one.
    if ((await getClientStatus(userId)) === 'connected') {
        console.log(`User ${userId} is already connected.`);
        return { status: 'authenticated', message: 'Já conectado.' };
    }
    
    // If there is any other client active, destroy it before creating a new one.
    await clearActiveClient(userId, true);
      
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
        const cleanupListeners = () => {
            client.removeListener('qr', handleQrCode);
            client.removeListener('ready', handleClientReady);
            client.removeListener('authenticated', handleAuthenticated);
            client.removeListener('auth_failure', handleAuthenticationFailure);
            client.removeListener('disconnected', handleDisconnected);
        };

        const handleAuthenticationFailure = async (msg: string) => {
          console.error(`AUTHENTICATION FAILURE for ${userId}:`, msg);
          cleanupListeners();
          await clearActiveClient(userId);
          reject(new Error('Authentication failure.'));
        };

        const handleClientReady = async () => {
          console.log(`Client for ${userId} is ready!`);
          
          client.on('message', (message) => handleIncomingMessage(message, userId));
          
          await setActiveClient(userId, client);

          cleanupListeners();
          
          // Trigger the flow to send messages to any existing pending contacts.
          sendNewContacts({ userId }).catch(error => {
              console.error(`Error during initial sendNewContacts for user ${userId}:`, error);
          });
          
          resolve({ status: 'authenticated' });
        };

        const handleAuthenticated = () => {
          console.log(`AUTHENTICATED for ${userId}`);
        };

        const handleDisconnected = async (reason: any) => {
          console.log(`Client for ${userId} was logged out:`, reason);
          cleanupListeners();
          await clearActiveClient(userId);
          reject(new Error(`Client disconnected: ${reason}`));
        };

        const handleQrCode = async (qr: string) => {
          console.log(`QR RECEIVED for ${userId}.`);
          try {
            const qrCodeDataUri = await qrcode.toDataURL(qr);
            resolve({ qr: qrCodeDataUri, status: 'pending' });
          } catch (err) {
            cleanupListeners();
            reject(err);
          }
        };
        
        client.once('qr', handleQrCode);
        client.once('ready', handleClientReady);
        client.once('authenticated', handleAuthenticated); 
        client.once('auth_failure', handleAuthenticationFailure);
        client.once('disconnected', handleDisconnected);
      });
      
      console.log(`Initializing WhatsApp client for ${userId}...`);
      await client.initialize();
      console.log('Client initialization process started.');

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.log(`Timeout reached for QR code generation or authentication for ${userId}.`);
          reject(new Error('Timeout: Process took too long. Please try again.'));
        }, QR_CODE_TIMEOUT);
      });
  
      const result = await Promise.race([connectionPromise, timeoutPromise]);
      return result;

    } catch (error) {
        console.error(`Flow error for user ${userId}:`, error);
        // Ensure the client is destroyed on error
        if (client.pupBrowser) {
            await client.destroy();
        }
        await clearActiveClient(userId);
        throw error; 
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
  }
);
