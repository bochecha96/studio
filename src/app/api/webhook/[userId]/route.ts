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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  console.log("==========================================");
  console.log("🚀 INICIANDO PROCESSAMENTO DE WEBHOOK");
  console.log(`⏰ Data e Hora: ${new Date().toISOString()}`);
  
  const userId = params.userId;
  console.log(`🆔 User ID recebido dos parâmetros: ${userId}`);

  if (!userId) {
      console.error("❌ Erro: User ID não encontrado nos parâmetros da URL.");
      return NextResponse.json({ status: 'error', message: 'User ID is missing from the webhook URL.' }, { status: 400, headers: corsHeaders });
  }
  
  try {
    const rawBody = await request.text();
    console.log("📥 Corpo da requisição (raw) recebido:", rawBody);

    let data: WebhookPayload;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      console.error("❌ Erro ao fazer o parse do JSON. O corpo recebido não é um JSON válido.");
      return NextResponse.json({ status: 'error', message: 'Invalid JSON format in request body.' }, { status: 400, headers: corsHeaders });
    }

    console.log("📦 Payload processado com sucesso:");
    console.log(JSON.stringify(data, null, 2));

    // Basic validation
    if (!data.customer_name || !data.customer_email || !data.product_name) {
        console.warn("⚠️ Payload inválido. Campos obrigatórios faltando.");
        console.log("Campos recebidos:", { 
            customer_name: !!data.customer_name, 
            customer_email: !!data.customer_email, 
            product_name: !!data.product_name 
        });
        return NextResponse.json({ status: 'error', message: 'Missing required fields: customer_name, customer_email, product_name' }, { status: 400, headers: corsHeaders });
    }
    console.log("✅ Validação do payload bem-sucedida.");

    // Save the new contact to Firestore
    console.log("📝 Tentando salvar novo contato no Firestore...");
    const newContactRef = await addDoc(collection(db, "contacts"), {
      userId: userId,
      name: data.customer_name,
      email: data.customer_email,
      phone: data.customer_phone || '', // Handle optional phone
      product: data.product_name,
      status: "Pendente",
      lastContact: serverTimestamp(),
    });
    
    console.log(`✅ Novo contato criado com sucesso no Firestore com o ID: ${newContactRef.id}`);

    // After successfully creating the contact, trigger the sendNewContacts flow asynchronously.
    console.log("🔄 Disparando o fluxo sendNewContacts em segundo plano...");
    sendNewContacts({ userId }).catch(error => {
        console.error("🔥 Erro ao iniciar o fluxo sendNewContacts em segundo plano:", error);
    });
    console.log("✅ Fluxo sendNewContacts disparado.");

    console.log("🎉 PROCESSAMENTO DE WEBHOOK FINALIZADO COM SUCESSO");
    console.log("==========================================");
    return NextResponse.json({ status: 'success', message: 'Webhook received and contact created' }, { status: 201, headers: corsHeaders });
    
  } catch (error: any) {
    console.error("❌ ERRO CRÍTICO NO PROCESSAMENTO DO WEBHOOK ❌");
    console.error("Detalhes do erro:", error);
    console.log("==========================================");
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// Add a GET handler for availability checks (optional, but good practice)
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
    // Await something from the request before accessing params
    await request.text();
    const userId = params.userId;
    console.log(`✅ GET request recebido para o webhook do usuário: ${userId}`);
    return NextResponse.json({ status: 'ok', message: `Webhook endpoint for user ${userId} is active.` }, { status: 200, headers: corsHeaders });
}

// Add a handler for OPTIONS requests to support CORS pre-flight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}
