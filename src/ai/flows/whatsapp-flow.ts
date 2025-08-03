'use server';
/**
 * @fileOverview A flow for handling WhatsApp Web connections.
 *
 * - generateQrCode - Generates a QR code for WhatsApp Web authentication.
 * - GenerateQrCodeInput - The input type for the generateQrCode function.
 * - GenerateQrCodeOutput - The return type for the generateQrCode function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessageFlow } from './sendMessage-flow';

const GenerateQrCodeInputSchema = z.object({
    userId: z.string().describe("The ID of the user initiating the connection."),
});
export type GenerateQrCodeInput = z.infer<typeof GenerateQrCodeInputSchema>;

const GenerateQrCodeOutputSchema = z.object({
  qr: z.string().optional().describe("The QR code as a data URI."),
  status: z.string().describe("The connection status."),
});
export type GenerateQrCodeOutput = z.infer<typeof GenerateQrCodeOutputSchema>;

interface Contact {
  id: string;
  name: string;
  phone?: string;
  product: string;
  userId: string;
}

let currentClient: Client | null = null; 
const QR_CODE_TIMEOUT = 70000;

async function destroyClient(clientToDestroy: Client | null) {
  if (clientToDestroy) {
    try {
      // It's possible pupBrowser is null if the client never launched fully.
      const isConnected = await clientToDestroy.pupBrowser?.isConnected();
      if (isConnected) {
        console.log('Attempting to destroy active client session...');
        await clientToDestroy.destroy();
        console.log('Client destroyed successfully.');
      } else {
        console.log('Client reference exists but browser is not connected. Clearing reference.');
      }
    } catch (e) {
      console.error('Error destroying client:', e);
    } finally {
       // Always remove listeners and clear the global reference.
       clientToDestroy.removeAllListeners();
      if (currentClient === clientToDestroy) {
        currentClient = null;
        console.log('Global client reference cleared.');
      }
    }
  }
}

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
    let currentFlowClient: Client | null = null;

    try {
      await destroyClient(currentClient);
      
      console.log(`Initializing client with puppeteer config for user ${userId}.`);

      currentFlowClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.resolve(process.cwd(), `.wweb_auth_${userId}`) }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      });
      currentClient = currentFlowClient;

      const qrPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
        const client = currentFlowClient;

        if (!client) {
            return reject(new Error('WhatsApp Client could not be initialized.'));
        }

        const cleanupListeners = () => {
            client.removeListener('qr', handleQrCode);
            client.removeListener('ready', handleClientReady);
            client.removeListener('authenticated', handleAuthenticated);
            client.removeListener('auth_failure', handleAuthenticationFailure);
            client.removeListener('disconnected', handleDisconnected);
        };

        const handleAuthenticationFailure = (msg: string) => {
          console.error('AUTHENTICATION FAILURE', msg);
          cleanupListeners();
          destroyClient(client);
          reject(new Error('Authentication failure.'));
        };

        const handleClientReady = async () => {
          console.log('Client is ready!');
          
          try {
            const pendingContacts = await fetchPendingContacts(userId);
            if (pendingContacts.length > 0 && client) {
               console.log("Starting to send messages to pending contacts...");
               await sendMessageFlow({ contacts: pendingContacts, client });
            } else {
               console.log("No pending contacts to message.");
            }
          } catch(e) {
            console.error("Error processing pending contacts:", e);
          }
          
          cleanupListeners();
          resolve({ status: 'authenticated' });
        };

        const handleAuthenticated = () => {
          console.log('AUTHENTICATED');
          cleanupListeners();
          // Do not resolve here, wait for 'ready' to send messages.
        };

        const handleDisconnected = (reason: any) => {
          console.log('Client was logged out', reason);
          cleanupListeners();
          destroyClient(client);
          reject(new Error(`Client disconnected: ${reason}`));
        };

        const handleQrCode = async (qr: string) => {
          console.log('QR RECEIVED. Printing to terminal...');
          qrcode.toString(qr, { type: 'terminal' }, (err, url) => {
            if (err) {
              console.error("Error generating QR for terminal", err);
              return;
            }
            console.log(url);
          });

          try {
            const qrCodeDataUri = await qrcode.toDataURL(qr);
            // Don't cleanup here, wait for ready or auth
            resolve({ qr: qrCodeDataUri, status: 'pending' });
          } catch (err) {
            cleanupListeners();
            reject(err);
          }
        };
        
        client.once('qr', handleQrCode);
        client.once('ready', handleClientReady);
        client.on('authenticated', handleAuthenticated); // Use .on to catch potential re-auth
        client.once('auth_failure', handleAuthenticationFailure);
        client.once('disconnected', handleDisconnected);
      });
      
      console.log('Initializing WhatsApp client...');
      await currentFlowClient.initialize();
      console.log('Client initialization process started.');

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.log('Timeout reached for QR code generation or authentication.');
          reject(new Error('Timeout: Process took too long. Please try again.'));
        }, QR_CODE_TIMEOUT);
      });
  
      const result = await Promise.race([qrPromise, timeoutPromise]);
      
      return result;

    } catch (error) {
        console.error("Flow error:", error);
        await destroyClient(currentFlowClient);
        throw error; 
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
  }
);
