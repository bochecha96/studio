import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const data = await request.json()
    const userId = params.userId

    console.log("==========================================")
    console.log("🚀 Webhook Recebido para o Usuário:", userId)
    console.log("📦 Payload:", JSON.stringify(data, null, 2))
    console.log("==========================================")

    // Aqui você pode adicionar a lógica para salvar os dados no Firestore,
    // criar um novo contato, etc.

    return NextResponse.json({ status: 'success', message: 'Webhook received' }, { status: 200 })
  } catch (error: any) {
    console.error("❌ Erro no Webhook:", error)
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
  }
}

// Adicionar um handler GET para verificações de disponibilidade (opcional, mas boa prática)
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Webhook endpoint is active.' }, { status: 200 })
}
