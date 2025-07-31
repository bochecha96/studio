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

// Avoid global client if multiple concurrent users are expected for this server action.
// If this is for a single, long-lived session on the server, then it might be okay.
// For multi-user scenarios, you'd need a session management approach.
let currentClient: Client | null = null; 
const QR_CODE_TIMEOUT = 70000; // 70 seconds

// Function to safely destroy and nullify the client
async function destroyClient(clientToDestroy: Client | null) {
  if (clientToDestroy && clientToDestroy.pupBrowser) { // Check if client exists and browser is still active
    try {
      // Remove all listeners to prevent memory leaks and unexpected behavior
      // This is crucial. If specific named functions were used, remove them.
      // Or, as we'll do below, ensure they are cleaned up on resolve/reject.
      clientToDestroy.removeAllListeners(); 
      await clientToDestroy.destroy();
      console.log('Client destroyed successfully.');
    } catch (e) {
      console.error('Error destroying client:', e);
    } finally {
      // Ensure the global reference is cleared only if it's the client we're destroying
      if (currentClient === clientToDestroy) {
        currentClient = null;
      }
    }
  } else if (clientToDestroy) { // Client exists but perhaps browser isn't active
      // Still try to clear listeners and nullify
      clientToDestroy.removeAllListeners();
      if (currentClient === clientToDestroy) {
        currentClient = null;
      }
      console.log('Client reference cleared, but no active browser to destroy.');
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
    let timeoutId: NodeJS.Timeout | undefined; // To store timeout reference
    let currentFlowClient: Client | null = null; // Client specific to this flow execution

    try {
      // Clean up any existing global client before starting a new one for this flow
      await destroyClient(currentClient);
      
      const executablePath = await chromium.executablePath || undefined;
      console.log(`Using Chromium executable at: ${executablePath}`);

      currentFlowClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          executablePath: executablePath,
          args: chromium.args,
        },
      });
      currentClient = currentFlowClient; // Set the global reference for this client

      qrPromise = new Promise<GenerateQrCodeOutput>((resolve, reject) => {
        const client = currentFlowClient; // Use a local reference inside the promise

        if (!client) {
            return reject(new Error('WhatsApp Client could not be initialized.'));
        }

        const cleanupListeners = () => {
            // Ensure all listeners are removed when the promise resolves or rejects
            client.removeListener('qr', handleQrCode);
            client.removeListener('ready', handleClientReady);
            client.removeListener('authenticated', handleAuthenticated);
            client.removeListener('auth_failure', handleAuthenticationFailure);
            client.removeListener('disconnected', handleDisconnected);
        };

        const handleAuthenticationFailure = (msg: string) => {
          console.error('AUTHENTICATION FAILURE', msg);
          cleanupListeners();
          destroyClient(client); // Destroy the client related to this flow
          reject(new Error('Authentication failure.'));
        };

        const handleClientReady = () => {
          console.log('Client is ready!');
          // We don't resolve here as we are waiting for QR code or auth.
          // This just indicates the client is connected, possibly from a previous session.
          // If a QR was NOT generated, but it's ready, this means it reconnected.
          // You might want to resolve immediately if 'ready' implies no QR is needed.
          // For now, assuming 'qr' is always the first expected event or auth.
        };

        const handleAuthenticated = () => {
          console.log('AUTHENTICATED');
          // If authenticated, we likely don't need a QR. Resolve.
          // This path needs to be considered for when the session is restored.
          cleanupListeners();
          resolve({ status: 'authenticated' }); // No QR needed if already authenticated
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
            cleanupListeners(); // Clean listeners once QR is successfully generated
            resolve({ qr: qrCodeDataUri, status: 'pending' });
          } catch (err) {
            cleanupListeners();
            reject(err);
          }
        };
        
        // Use `on` for events that might happen multiple times (like 'message') if needed
        // but for connection flow, `once` is often appropriate for key state changes.
        client.once('qr', handleQrCode);
        client.once('ready', handleClientReady);
        client.once('authenticated', handleAuthenticated);
        client.once('auth_failure', handleAuthenticationFailure);
        client.once('disconnected', handleDisconnected);
      });
      
      // Initialize the client. This needs to be awaited to catch immediate errors.
      await currentFlowClient.initialize();
      console.log('Client initialization initiated.');

    } catch (error) {
        console.error("Initialization or pre-QR setup error:", error);
        // If an error occurs before the qrPromise is even set up,
        // we must clean up and re-throw.
        await destroyClient(currentFlowClient); // Ensure this specific client instance is cleaned.
        throw error;
    }
    
    // Set a timeout for the entire process
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        console.log('Timeout reached for QR code generation.');
        destroyClient(currentFlowClient); // Destroy the client specific to this timed-out flow
        reject(new Error('Timeout: QR Code generation took too long.'));
      }, QR_CODE_TIMEOUT);
    });

    // Race the qrPromise against the timeout
    const result = await Promise.race([qrPromise, timeoutPromise]);
    
    // If qrPromise resolves, clear the timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  }
);
