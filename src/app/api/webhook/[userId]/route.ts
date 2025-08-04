import { NextResponse } from 'next/server'
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from '@/lib/firebase'
import { sendNewContacts } from '@/ai/flows/sendNewContacts-flow'

// Define a structure for the incoming webhook data for better type safety
// This is a generic example, you should adapt it to your webhook provider's payload
interface WebhookPayload {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  product_name: string;
  // Add any other relevant fields from your webhook provider
}

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const data: WebhookPayload = await request.json()
    const userId = params.userId

    console.log("==========================================")
    console.log("🚀 Webhook Recebido para o Usuário:", userId)
    console.log("📦 Payload:", JSON.stringify(data, null, 2))
    console.log("==========================================")
    
    // Basic validation
    if (!data.customer_name || !data.customer_email || !data.product_name) {
        return NextResponse.json({ status: 'error', message: 'Missing required fields: customer_name, customer_email, product_name' }, { status: 400 })
    }

    // Save the new contact to Firestore
    const newContactRef = await addDoc(collection(db, "contacts"), {
      userId: userId,
      name: data.customer_name,
      email: data.customer_email,
      phone: data.customer_phone || '', // Handle optional phone
      product: data.product_name,
      status: "Pendente",
      lastContact: serverTimestamp(),
    })
    
    console.log(`📝 Novo contato criado com o ID: ${newContactRef.id}`);

    // After successfully creating the contact, trigger the sendNewContacts flow asynchronously.
    // We don't wait for it to finish to ensure the webhook returns a response quickly.
    sendNewContacts({ userId }).catch(error => {
        console.error("🔥 Erro ao iniciar o fluxo sendNewContacts em segundo plano:", error);
    });

    return NextResponse.json({ status: 'success', message: 'Webhook received and contact created' }, { status: 201 })
    
  } catch (error: any) {
    console.error("❌ Erro no Webhook:", error)
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
  }
}

// Add a GET handler for availability checks (optional, but good practice)
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Webhook endpoint is active.' }, { status: 200 })
}
