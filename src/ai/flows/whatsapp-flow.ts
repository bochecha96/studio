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
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendMessage, type Contact } from './sendMessage-flow';

const GenerateQrCodeInputSchema = z.object({
    userId: z.string().describe("The ID of the user initiating the connection."),
});
export type GenerateQrCodeInput = z.infer<typeof GenerateQrCodeInputSchema>;

const GenerateQrCodeOutputSchema = z.object({
  qr: z.string().optional().describe("The QR code as a data URI."),
  status: z.string().describe("The connection status."),
});
export type GenerateQrCodeOutput = z.infer<typeof GenerateQrCodeOutputSchema>;


let currentClient: Client | null = null; 
const QR_CODE_TIMEOUT = 70000;

async function destroyClient(clientToDestroy: Client | null) {
  if (clientToDestroy) {
    try {
      console.log('Attempting to destroy active client session...');
      if (clientToDestroy.pupBrowser) {
        await clientToDestroy.destroy();
        console.log('Client destroyed successfully.');
      } else {
        console.log('Client reference exists but browser was not initialized. Clearing reference.');
      }
    } catch (e) {
      console.error('Error destroying client:', e);
    } finally {
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

async function handleIncomingMessage(message: any, userId: string) {
    try {
        const chatId = message.from;
        const phone = chatId.split('@')[0];
        console.log(`New message from ${phone}: "${message.body}"`);

        // Find the contact by phone number for the specific user
        const q = query(
            collection(db, 'contacts'),
            where('userId', '==', userId),
            where('phone', '==', phone),
            where('status', '==', 'Contatado') // Only act on contacts we've already messaged
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log(`No pending contact found for ${phone} and user ${userId}. Ignoring.`);
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

      const connectionPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
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
            client.removeListener('message', (message) => handleIncomingMessage(message, userId));
        };

        const handleAuthenticationFailure = (msg: string) => {
          console.error('AUTHENTICATION FAILURE', msg);
          cleanupListeners();
          destroyClient(client);
          reject(new Error('Authentication failure.'));
        };

        const handleClientReady = async () => {
          console.log('Client is ready!');
          
          client.on('message', (message) => handleIncomingMessage(message, userId));

          cleanupListeners();
          
          try {
            const pendingContacts = await fetchPendingContacts(userId);
            if (pendingContacts.length > 0 && client) {
               console.log("Starting to send messages to pending contacts...");
               await sendMessage({ contacts: pendingContacts, client });
            } else {
               console.log("No pending contacts to message.");
            }
          } catch(e) {
            console.error("Error processing pending contacts:", e);
          }
          
          resolve({ status: 'authenticated' });
        };

        const handleAuthenticated = () => {
          console.log('AUTHENTICATED');
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
      
      console.log('Initializing WhatsApp client...');
      await currentFlowClient.initialize();
      console.log('Client initialization process started.');

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.log('Timeout reached for QR code generation or authentication.');
          reject(new Error('Timeout: Process took too long. Please try again.'));
        }, QR_CODE_TIMEOUT);
      });
  
      const result = await Promise.race([connectionPromise, timeoutPromise]);
      
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
