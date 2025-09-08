
"use client"

import { useState, useEffect, useRef } from "react"
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
import { QrCode, XCircle, CheckCircle, Loader2, Copy, Check, Info, Send, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateQrCode, clearActiveClient, checkClientStatus } from "@/ai/flows/whatsapp-flow"
import { resendMessages } from "@/ai/flows/resendMessages-flow"
import { app } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"


type ConnectionStatus = "disconnected" | "connected" | "loading" | "error" | "pending_qr";

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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // Effect for authenticating user and setting initial state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoadingUser(true);
      if (currentUser) {
        setUser(currentUser)
        if (typeof window !== "undefined") {
          setWebhookUrl(`${window.location.origin}/api/webhook/${currentUser.uid}`)
        }
        // Initial status check
        checkClientStatus({userId: currentUser.uid}).then(res => setStatus(res.status as ConnectionStatus));
      } else {
        setUser(null)
        setStatus("disconnected");
      }
      setLoadingUser(false)
    })
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      unsubscribe();
    }
  }, [auth]);

  // Cleanup polling when status is not pending anymore
  useEffect(() => {
    if (status !== 'pending_qr' && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [status]);


  const handleGenerateQrCode = async () => {
    if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
    }

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    setStatus("loading")
    setQrCode(null)

    try {
        // We ensure any previous connection or attempt is fully cleared.
        await clearActiveClient({ userId: user.uid });
        
        const result = await generateQrCode({ userId: user.uid });

        if (result.qr) {
            setQrCode(result.qr);
            setStatus("pending_qr");

            // Start polling ONLY after we get a QR code
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const statusResult = await checkClientStatus({ userId: user.uid });
                    if (statusResult.status === 'connected') {
                        setStatus('connected');
                        setQrCode(null);
                        toast({
                            title: "Conexão estabelecida!",
                            description: "Seu WhatsApp foi conectado com sucesso.",
                        });
                        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    }
                } catch (pollError) {
                    console.error("Error polling for status:", pollError);
                }
            }, 3000); // Poll every 3 seconds

        } else {
            setStatus("error");
            toast({
                title: "Erro na Conexão",
                description: result.message || "Não foi possível obter o QR Code.",
                variant: "destructive",
            });
        }
    } catch (error: any) {
        console.error("Error in handleGenerateQrCode:", error);
        setStatus("error");
        setQrCode(null);
        toast({
            title: "Erro na Conexão",
            description: error.message || "Não foi possível conectar. Tente novamente.",
            variant: "destructive",
        });
    }
  }
  
  const handleDisconnect = async () => {
    if (!user) return;
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    try {
        await clearActiveClient({ userId: user.uid });
        setStatus("disconnected")
        setQrCode(null)
        toast({
            title: "Desconectado",
            description: "Sua sessão do WhatsApp foi encerrada.",
        })
    } catch(error: any) {
         toast({
            title: "Erro ao Desconectar",
            description: "Não foi possível encerrar a sessão. Tente novamente.",
            variant: "destructive"
        });
    }
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
    toast({ title: "Iniciando Envio", description: "Suas mensagens estão sendo preparadas. Isso pode levar um minuto."})
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
          badge: <Badge variant="default" className="flex items-center gap-1 bg-green-500 text-white hover:bg-green-600"><CheckCircle className="h-3 w-3" />Conectado</Badge>,
          description: "Sua sessão está ativa e pronta para enviar e receber mensagens.",
        }
       case "pending_qr":
         return {
          badge: <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Aguardando</Badge>,
          description: "Escaneie o QR Code com seu celular para conectar.",
        }
      case "loading":
         return {
          badge: <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Carregando</Badge>,
          description: "Verificando status da conexão...",
        }
      case "error":
         return {
          badge: <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Erro</Badge>,
          description: "Falha ao tentar conectar. Clique para tentar novamente.",
        }
      case "disconnected":
      default:
        return {
          badge: <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Desconectado</Badge>,
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
                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                    <p className="text-muted-foreground">Carregando dados do usuário...</p>
                 </div>
            ) : status === "pending_qr" && qrCode ? (
              <>
                <Image src={qrCode} alt="QR Code do WhatsApp" width={200} height={200} />
                <p className="text-muted-foreground">Aguardando a leitura do código...</p>
              </>
            ) : status === "loading" ? (
                 <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                    <p className="text-muted-foreground">Gerando QR Code...</p>
                 </div>
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
                        {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        {isSendingTest ? "Enviando..." : "Reenviar Pendentes"}
                    </Button>
                 </div>
                </>
            ) : (
                <div className="p-4 bg-muted rounded-md dark:bg-zinc-800">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
            )}
             {status !== "connected" && !loadingUser && (
                <Button onClick={handleGenerateQrCode} disabled={status === 'loading' || status === 'pending_qr'}>
                    <QrCode className="mr-2 h-4 w-4" />
                    {status === 'loading' || status === 'pending_qr' ? 'Aguarde...' : 'Gerar QR Code'}
                 </Button>
             )}
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
                Esta URL é única para sua conta. Para que funcione, sua plataforma deve enviar os dados (POST) no formato JSON .
              </AlertDescription>
            </Alert>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
