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
import { QrCode, XCircle, CheckCircle, Loader, Copy, Check, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateQrCode } from "@/ai/flows/whatsapp-flow"
import { app } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

type ConnectionStatus = "disconnected" | "connected" | "loading" | "error"

export default function SettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("loading")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const { toast } = useToast()
  const auth = getAuth(app)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        if (typeof window !== "undefined") {
          setWebhookUrl(`${window.location.origin}/api/webhook/${currentUser.uid}`)
          const storedStatus = localStorage.getItem("whatsappStatus") as ConnectionStatus | null;
          if (storedStatus) {
            setStatus(storedStatus);
          } else {
            setStatus("disconnected");
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
    if (status !== 'loading') { // Don't save loading state
        localStorage.setItem("whatsappStatus", status);
    }
  }, [status]);
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (status === 'loading' && qrCode) {
        timeoutId = setTimeout(() => {
            setStatus('error');
            setQrCode(null);
            toast({
                title: "Tempo Esgotado",
                description: "Você demorou muito para escanear o QR Code. Tente novamente.",
                variant: "destructive",
            });
        }, 60000); // 60s to scan
    }
    return () => clearTimeout(timeoutId);
  }, [status, qrCode, toast]);


  const handleGenerateQrCode = async () => {
    setStatus("loading")
    setQrCode(null)
    try {
      const result = await generateQrCode({})
      
      if (result.qr) {
        setQrCode(result.qr)
      } else {
        // This case might happen if client is already authenticated without sending a QR
        if (result.status === 'authenticated') {
            handleAssumeConnected();
        } else {
            throw new Error("Não foi possível gerar o QR Code.")
        }
      }
    } catch (error: any) {
      console.error(error)
      setStatus("error")
      toast({
        title: "Erro na Conexão",
        description: error.message || "Não foi possível conectar. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const handleAssumeConnected = () => {
    setStatus("connected");
    setQrCode(null);
    toast({
        title: "Conexão estabelecida",
        description: "Seu WhatsApp foi conectado com sucesso.",
    });
  }
  
  const handleDisconnect = () => {
    // In a real app, you would also need a backend call to client.destroy()
    setStatus("disconnected")
    setQrCode(null)
    toast({
        title: "Desconectado",
        description: "Sua sessão do WhatsApp foi encerrada.",
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
          description: "Sua sessão está ativa.",
        }
      case "loading":
         return {
          badge: (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader className="h-3 w-3 animate-spin" />
              Aguardando
            </Badge>
          ),
          description: qrCode ? "Escaneie o QR Code para conectar." : "Aguardando status...",
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
            {status === "loading" && qrCode && (
              <>
                <Image src={qrCode} alt="QR Code do WhatsApp" width={200} height={200} />
                <p className="text-muted-foreground">Escaneie o código acima com seu celular.</p>
                <Button onClick={handleAssumeConnected} variant="outline">Já escaneei, conectar</Button>
              </>
            )}
            {status === "loading" && !qrCode && (
                 <div className="flex flex-col items-center gap-4">
                    <Loader className="h-16 w-16 text-primary animate-spin" />
                    <p className="text-muted-foreground">Gerando QR Code...</p>
                 </div>
            )}
            {(status === "disconnected" || status === "error") && (
                <>
                 <div className="p-4 bg-muted rounded-md">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                 </div>
                 <p className="text-muted-foreground">{status === 'error' ? 'Ocorreu um erro.' : 'Nenhum QR gerado ainda.'}</p>
                 <Button onClick={handleGenerateQrCode} disabled={status === 'loading'}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Gerar novo QR Code
                 </Button>
                </>
            )}
             {status === "connected" && (
                <>
                 <div className="p-4 bg-green-100 rounded-md dark:bg-green-900/50">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                 </div>
                 <p className="text-muted-foreground">Seu número está conectado e pronto para uso.</p>
                 <Button variant="destructive" onClick={handleDisconnect}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Desconectar
                 </Button>
                </>
            )}
          </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="text-xl">Webhook de Vendas</CardTitle>
          <CardDescription>
            Conecte sua plataforma de vendas (Hotmart, Kiwify, etc.) usando este webhook para receber notificações de vendas em tempo real.
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
                Esta URL é única para sua conta. Não a compartilhe com ninguém.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
