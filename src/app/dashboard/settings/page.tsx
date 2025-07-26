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

type ConnectionStatus = "disconnected" | "connected" | "loading"

export default function SettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const { toast } = useToast()

  const handleGenerateQrCode = async () => {
    setStatus("loading")
    setQrCode(null)
    try {
      const result = await generateQrCode({})
      if (result.qr) {
        setQrCode(result.qr)
        // Mocking connection success after a delay for demonstration
        setTimeout(() => {
          if (status === 'loading') { // check if still in loading state
             setStatus("connected")
             setQrCode(null)
             toast({
                title: "Conexão estabelecida",
                description: "Seu WhatsApp foi conectado com sucesso.",
             })
          }
        }, 30000) // 30s to scan
      } else {
        throw new Error("Não foi possível gerar o QR Code.")
      }
    } catch (error) {
      console.error(error)
      setStatus("disconnected")
      toast({
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar um novo QR Code. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          text: "Conectado",
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
          text: "Aguardando conexão",
          badge: (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader className="h-3 w-3 animate-spin" />
              Aguardando
            </Badge>
          ),
          description: "Escaneie o QR Code para conectar.",
        }
      case "disconnected":
      default:
        return {
          text: "Desconectado",
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
            {status === "disconnected" && (
                <>
                 <div className="p-4 bg-muted rounded-md">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                 </div>
                 <p className="text-muted-foreground">Nenhum QR gerado ainda.</p>
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
                 <Button variant="destructive" onClick={() => setStatus("disconnected")}>
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
