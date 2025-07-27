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
import { Client } from 'whatsapp-web.js';
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
    return new Promise((resolve, reject) => {
      if (client) {
         // If a client exists, try to clean it up before creating a new one.
         // This is a basic way to handle reconnection attempts.
         client.destroy().catch(console.error);
      }

      client = new Client({
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      });

      const timeout = setTimeout(() => {
         client?.destroy();
         reject(new Error('Timeout: QR Code generation took too long.'));
      }, 60000); // 60-second timeout

      client.on('qr', async (qr) => {
        console.log('QR RECEIVED', qr);
        try {
          const qrCodeDataUri = await qrcode.toDataURL(qr);
          clearTimeout(timeout);
          resolve({ qr: qrCodeDataUri, status: 'pending' });
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      client.on('ready', () => {
        console.log('Client is ready!');
        clearTimeout(timeout);
        // In a real app, you would update the status to 'connected'
        // and probably store the session data here.
      });

       client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE', msg);
        clearTimeout(timeout);
        reject(new Error('Authentication failure.'));
      });

      client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        client = null; // Clear the client instance
      });

      client.initialize().catch(err => {
         clearTimeout(timeout);
         reject(err)
      });
    });
  }
);
