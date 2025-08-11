/**
 * @fileoverview This file sets up a cron job to periodically run tasks.
 * It will run a check every 5 minutes for all active WhatsApp clients
 * and trigger the message sending flow for any pending contacts.
 */
import { getAllClients } from "@/lib/whatsapp-client-manager";
import { sendNewContacts } from "@/ai/flows/sendNewContacts-flow";

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function runCron() {
  console.log(`[CRON] Running scheduled task at ${new Date().toISOString()}`);

  const activeClients = getAllClients();

  if (activeClients.size === 0) {
    console.log("[CRON] No active clients found. Skipping task.");
    return;
  }

  console.log(`[CRON] Found ${activeClients.size} active clients. Processing...`);

  activeClients.forEach((_, userId) => {
    console.log(`[CRON] Triggering sendNewContacts for user ${userId}`);
    sendNewContacts({ userId })
      .then(result => {
        if (result.success && result.count > 0) {
          console.log(`[CRON] Successfully sent ${result.count} messages for user ${userId}.`);
        } else if (result.success && result.count === 0) {
           console.log(`[CRON] No pending contacts to send for user ${userId}.`);
        } else {
          console.error(`[CRON] Failed to send messages for user ${userId}: ${result.message}`);
        }
      })
      .catch(error => {
        console.error(`[CRON] An unexpected error occurred for user ${userId}:`, error);
      });
  });
}

// Initialize the cron job.
// This check ensures it only runs on the server, not in the browser or during build.
if (typeof window === "undefined") {
    console.log(`[CRON] Service initialized. Tasks will run every ${CRON_INTERVAL_MS / 1000 / 60} minutes.`);
    setInterval(runCron, CRON_INTERVAL_MS);
}
