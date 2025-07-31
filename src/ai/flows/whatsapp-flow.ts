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

const GenerateQrCodeInputSchema = z.object({});
export type GenerateQrCodeInput = z.infer<typeof GenerateQrCodeInputSchema>;

const GenerateQrCodeOutputSchema = z.object({
  qr: z.string().optional().describe("The QR code as a data URI."),
  status: z.string().describe("The connection status."),
});
export type GenerateQrCodeOutput = z.infer<typeof GenerateQrCodeOutputSchema>;

let client: Client | null = null;
const QR_CODE_TIMEOUT = 70000; // 70 seconds

async function cleanupClient() {
  if (client) {
    try {
      // Remove all listeners to prevent memory leaks and unexpected behavior
      client.removeAllListeners();
      await client.destroy();
    } catch (e) {
      console.error('Error destroying client:', e);
    } finally {
      client = null;
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
    let qrPromise: Promise<GenerateQrCodeOutput>;

    try {
        await cleanupClient();

        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        qrPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
            const handleAuthenticationFailure = (msg: string) => {
                console.error('AUTHENTICATION FAILURE', msg);
                cleanupClient();
                reject(new Error('Authentication failure.'));
            };

            const handleClientReady = () => {
                console.log('Client is ready!');
            };

            const handleAuthenticated = () => {
                console.log('AUTHENTICATED');
            };

            const handleDisconnected = (reason: any) => {
                console.log('Client was logged out', reason);
                cleanupClient();
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
                    reject(err);
                } finally {
                    client?.removeListener('auth_failure', handleAuthenticationFailure);
                    client?.removeListener('ready', handleClientReady);
                }
            };
            
            client.once('qr', handleQrCode);
            client.once('ready', handleClientReady);
            client.once('authenticated', handleAuthenticated);
            client.once('auth_failure', handleAuthenticationFailure);
            client.once('disconnected', handleDisconnected);
        });
        
        client.initialize().catch(err => {
            console.error("Initialization error:", err);
            // Don't reject here; let the timeout handle it to avoid race conditions.
        });

    } catch (error) {
        await cleanupClient();
        throw error;
    }
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        cleanupClient();
        reject(new Error('Timeout: QR Code generation took too long.'));
      }, QR_CODE_TIMEOUT)
    );

    return Promise.race([qrPromise, timeoutPromise]);
  }
);