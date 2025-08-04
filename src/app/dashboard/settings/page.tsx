"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { getAuth, onAuthStateChanged, User } from "firebase/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { QrCode, XCircle, CheckCircle, Loader, Copy, Check, Info, Send, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateQrCode } from "@/ai/flows/whatsapp-flow"
import { resendMessages } from "@/ai/flows/resendMessages-flow"
import { app } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { clearActiveClient } from "@/ai/flows/sendNewContacts-flow"


type ConnectionStatus = "disconnected" | "connected" | "loading" | "error"

export default function SettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("loading")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const { toast } = useToast()
  const auth = getAuth(app)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        if (typeof window !== "undefined") {
          setWebhookUrl(`${window.location.origin}/api/webhook/${currentUser.uid}`)
          // Check initial status from server or local storage
          const storedStatus = localStorage.getItem(`whatsappStatus_${currentUser.uid}`) as ConnectionStatus | null;
          if (storedStatus === 'connected') {
             // We assume connected, but a server-side check would be more robust
             setStatus('connected');
          } else {
             setStatus('disconnected');
          }
        }
      } else {
        setUser(null)
        setStatus("disconnected");
      }
      setLoadingUser(false)
    })
    return () => unsubscribe()
  }, [auth])

  useEffect(() => {
    // Persist status to local storage to provide a better UX across page reloads.
    if (user && status !== 'loading') { 
        localStorage.setItem(`whatsappStatus_${user.uid}`, status);
    }
  }, [status, user]);

  const handleGenerateQrCode = async () => {
    if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
    }
    setStatus("loading")
    setQrCode(null)
    try {
      const result = await generateQrCode({ userId: user.uid })
      
      if (result.qr) {
        setQrCode(result.qr)
        // Status remains 'loading' while QR is shown. The flow will resolve with 'authenticated' when ready.
      } else if (result.status === 'authenticated') {
         handleConnectionSuccess(result.message);
      } else {
         // This can happen if the client was already authenticated on the server
         // and the 'ready' event fired immediately without a new QR code.
         handleConnectionSuccess();
      }
    } catch (error: any) {
      console.error("Error in handleGenerateQrCode:", error)
      setStatus("error")
      setQrCode(null);
      toast({
        title: "Erro na Conexão",
        description: error.message || "Não foi possível conectar. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const handleConnectionSuccess = (message?: string) => {
    setStatus("connected");
    setQrCode(null);
    toast({
        title: "Conexão estabelecida!",
        description: message || "Seu WhatsApp foi conectado com sucesso e as mensagens de recuperação foram enviadas aos contatos pendentes.",
    });
  }
  
  const handleDisconnect = async () => {
    if (!user) return;
    
    // Call backend to destroy the session
    try {
        await clearActiveClient(user.uid, true);
    } catch (e) {
        console.error("Error during server-side client destruction:", e);
    }

    // Update UI immediately
    setStatus("disconnected")
    setQrCode(null)
    localStorage.setItem(`whatsappStatus_${user.uid}`, 'disconnected');
    toast({
        title: "Desconectado",
        description: "Sua sessão do WhatsApp foi encerrada no servidor.",
    })
  }
  
  const handleCopyWebhook = () => {
    if (!webhookUrl) return
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast({
        title: "Copiado!",
        description: "URL do Webhook copiada para a área de transferência.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTestSend = async () => {
    if (!user) {
       toast({ title: "Erro", description: "Você não está logado.", variant: "destructive" });
       return;
    }
    setIsSendingTest(true);
    try {
        const result = await resendMessages({userId: user.uid});
        if (result.success) {
            toast({
                title: "Operação Concluída",
                description: result.message
            });
        } else {
             toast({
                title: "Erro ao Enviar",
                description: result.message,
                variant: "destructive"
            });
        }
    } catch (error: any) {
         toast({
            title: "Erro Inesperado",
            description: "Ocorreu um erro ao tentar reenviar as mensagens.",
            variant: "destructive"
        });
        console.error("Error resending messages:", error);
    } finally {
        setIsSendingTest(false);
    }
  }

  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          badge: (
            <Badge variant="default" className="flex items-center gap-1 bg-green-500 text-white hover:bg-green-600">
              <CheckCircle className="h-3 w-3" />
              Conectado
            </Badge>
          ),
          description: "Sua sessão está ativa e pronta para enviar mensagens.",
        }
      case "loading":
         return {
          badge: (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader className="h-3 w-3 animate-spin" />
              Aguardando
            </Badge>
          ),
          description: qrCode ? "Escaneie o QR Code para conectar." : "Iniciando conexão...",
        }
      case "error":
         return {
          badge: (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Erro
            </Badge>
          ),
          description: "Falha ao tentar conectar.",
        }
      case "disconnected":
      default:
        return {
          badge: (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Desconectado
            </Badge>
          ),
          description: "Nenhuma sessão ativa encontrada.",
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Conexão WhatsApp</CardTitle>
          <CardDescription>
            Conecte seu número escaneando o QR Code com o app WhatsApp, assim
            como no WhatsApp Web.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Status da Conexão</h3>
                <p className="text-sm text-muted-foreground">
                  {statusInfo.description}
                </p>
              </div>
              {statusInfo.badge}
            </div>
          </div>
          <div className="p-4 border rounded-lg flex flex-col items-center justify-center text-center space-y-4 min-h-[280px]">
             {loadingUser ? (
                 <div className="flex flex-col items-center gap-4">
                    <Loader className="h-16 w-16 text-primary animate-spin" />
                    <p className="text-muted-foreground">Carregando dados do usuário...</p>
                 </div>
            ) : status === "loading" && qrCode ? (
              <>
                <Image src={qrCode} alt="QR Code do WhatsApp" width={200} height={200} />
                <p className="text-muted-foreground">Escaneie o código acima com seu celular.</p>
              </>
            ) : status === "loading" && !qrCode ? (
                 <div className="flex flex-col items-center gap-4">
                    <Loader className="h-16 w-16 text-primary animate-spin" />
                    <p className="text-muted-foreground">Estabelecendo conexão...</p>
                 </div>
            ) : (status === "disconnected" || status === "error") ? (
                <>
                 <div className="p-4 bg-muted rounded-md dark:bg-zinc-800">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                 </div>
                 <p className="text-muted-foreground max-w-xs">{status === 'error' ? 'Ocorreu um erro. Clique para tentar novamente.' : 'Clique no botão para gerar um novo QR Code e conectar.'}</p>
                 <Button onClick={handleGenerateQrCode} disabled={loadingUser}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Conectar com WhatsApp
                 </Button>
                </>
            ) : status === "connected" ? (
                <>
                 <div className="p-4 bg-green-100 rounded-md dark:bg-green-900/50">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                 </div>
                 <p className="text-muted-foreground max-w-xs">Seu número está conectado e pronto para uso.</p>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="destructive" onClick={handleDisconnect}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Desconectar
                    </Button>
                    <Button onClick={handleTestSend} disabled={isSendingTest}>
                        {isSendingTest ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        {isSendingTest ? "Enviando..." : "Reenviar Pendentes"}
                    </Button>
                 </div>
                </>
            ) : null}
          </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="text-xl">Webhook de Vendas</CardTitle>
          <CardDescription>
            Conecte sua plataforma de vendas (Hotmart, Kiwify, etc.) usando este webhook para adicionar novos contatos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Sua URL de Webhook única</Label>
              <div className="flex items-center space-x-2 mt-2">
                {loadingUser ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Input id="webhook-url" type="text" readOnly value={webhookUrl} className="text-muted-foreground"/>
                )}
                <Button variant="secondary" size="icon" onClick={handleCopyWebhook} disabled={loadingUser || !webhookUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="sr-only">Copiar URL do Webhook</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Copie esta URL e cole no campo de webhook da sua plataforma de vendas.
              </p>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Esta URL é única para sua conta. Para que funcione, sua plataforma deve enviar os dados (POST) no formato JSON com os campos: `customer_name`, `customer_email`, `product_name` e, opcionalmente, `customer_phone`.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
