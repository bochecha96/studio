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


const GenerateQrCodeInputSchema = z.object({});
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
      // Check if the browser is connected before trying to close it.
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
       // Clear all listeners to prevent memory leaks
      clientToDestroy.removeAllListeners();
      if (currentClient === clientToDestroy) {
        currentClient = null;
        console.log('Global client reference cleared.');
      }
    }
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
  async () => {
    let timeoutId: NodeJS.Timeout | undefined;
    let currentFlowClient: Client | null = null;

    try {
      // Always clean up any existing client before starting a new one.
      await destroyClient(currentClient);
      
      console.log(`Initializing client with default puppeteer config.`);

      currentFlowClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.resolve(process.cwd(), '.wweb_auth') }),
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

        const handleClientReady = () => {
          console.log('Client is ready!');
          cleanupListeners();
          resolve({ status: 'authenticated' });
        };

        const handleAuthenticated = () => {
          console.log('AUTHENTICATED');
          cleanupListeners();
          resolve({ status: 'authenticated' });
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
            cleanupListeners(); // Important to cleanup here to avoid multiple resolves
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
  
      const result = await Promise.race([qrPromise, timeoutPromise]);
      
      return result;

    } catch (error) {
        console.error("Flow error:", error);
        throw error; // Re-throw the error to be caught by the caller
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
  }
);
