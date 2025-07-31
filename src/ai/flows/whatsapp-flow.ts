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
import chromium from 'chrome-aws-lambda';

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
      if (clientToDestroy.pupBrowser) {
        clientToDestroy.removeAllListeners();
        await clientToDestroy.destroy();
        console.log('Client destroyed successfully.');
      } else {
         clientToDestroy.removeAllListeners();
         console.log('Client reference cleared, but no active browser to destroy.');
      }
    } catch (e) {
      console.error('Error destroying client:', e);
    } finally {
      if (currentClient === clientToDestroy) {
        currentClient = null;
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
      await destroyClient(currentClient);
      
      const executablePath = await chromium.executablePath;
      if (!executablePath) {
        throw new Error('Chromium executable not found. `chrome-aws-lambda` may not be installed correctly.');
      }
      console.log(`Using Chromium executable at: ${executablePath}`);

      currentFlowClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          executablePath: executablePath,
          args: chromium.args,
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
            cleanupListeners();
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
      
      await currentFlowClient.initialize();
      console.log('Client initialization initiated.');

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.log('Timeout reached for QR code generation.');
          destroyClient(currentFlowClient);
          reject(new Error('Timeout: QR Code generation took too long.'));
        }, QR_CODE_TIMEOUT);
      });
  
      const result = await Promise.race([qrPromise, timeoutPromise]);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      return result;

    } catch (error) {
        console.error("Flow error:", error);
        await destroyClient(currentFlowClient);
        // Re-throw the error to be caught by the caller
        throw error;
    }
  }
);
