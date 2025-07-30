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

// This is a simplified example. In a real app, you would need to manage
// the client instance and session state more robustly, likely using a
// persistent store or a dedicated service.
let client: Client | null = null;
let connectionCheckInterval: NodeJS.Timeout | null = null;

async function cleanupClient() {
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.error('Error destroying client:', e);
    }
    client = null;
  }
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
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
    await cleanupClient();

    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    const qrPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
        client!.on('qr', async (qr) => {
          console.log('QR RECEIVED', qr);
          try {
            const qrCodeDataUri = await qrcode.toDataURL(qr);
            resolve({ qr: qrCodeDataUri, status: 'pending' });
          } catch (err) {
            reject(err);
          }
        });

        client!.on('ready', () => {
            console.log('Client is ready!');
            // The frontend will handle the status update to "connected"
        });

        client!.on('authenticated', () => {
            console.log('AUTHENTICATED');
        });

        client!.on('auth_failure', (msg) => {
            console.error('AUTHENTICATION FAILURE', msg);
            reject(new Error('Authentication failure.'));
            cleanupClient();
        });

        client!.on('disconnected', (reason) => {
            console.log('Client was logged out', reason);
            cleanupClient();
        });
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error('Timeout: QR Code generation took too long.'));
        cleanupClient();
      }, 60000) // 60-second timeout
    );

    try {
        client.initialize().catch(err => {
            console.error("Initialization error:", err);
            cleanupClient();
        });
        return await Promise.race([qrPromise, timeoutPromise]);
    } catch (error) {
        await cleanupClient();
        throw error;
    }
  }
);
