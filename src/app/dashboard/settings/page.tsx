"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, XCircle, CheckCircle, Loader } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { generateQrCode } from "@/ai/flows/whatsapp-flow"

type ConnectionStatus = "disconnected" | "connected" | "loading" | "error"

export default function SettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const { toast } = useToast()

  const handleGenerateQrCode = async () => {
    setStatus("loading")
    setQrCode(null)
    try {
      // Set a timeout on the frontend as well to avoid waiting forever
      const race = Promise.race([
        generateQrCode({}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Frontend Timeout')), 70000)) // 70s
      ]);

      const result: any = await race;
      
      if (result.qr) {
        setQrCode(result.qr)
        // Mocking connection success after a delay for demonstration
        // In a real app, the 'ready' event from whatsapp-web.js would trigger this
        setTimeout(() => {
          if (status === 'loading') { // check if still in loading state
             setStatus("connected")
             setQrCode(null)
             toast({
                title: "Conexão estabelecida",
                description: "Seu WhatsApp foi conectado com sucesso.",
             })
          }
        }, 45000) // 45s to scan
      } else {
        throw new Error("Não foi possível gerar o QR Code.")
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
  
  const handleDisconnect = () => {
    // In a real app, you would also need a backend call to client.destroy()
    setStatus("disconnected")
    setQrCode(null)
    toast({
        title: "Desconectado",
        description: "Sua sessão do WhatsApp foi encerrada.",
    })
  }


  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          badge: (
            <Badge variant="default" className="flex items-center gap-1 bg-green-500 text-white">
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
          description: "Escaneie o QR Code para conectar.",
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
    <div className="p-6 space-y-6">
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
                 <Button onClick={handleGenerateQrCode}>
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
    </div>
  )
}
