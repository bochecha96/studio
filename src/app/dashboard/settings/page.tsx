"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, XCircle } from "lucide-react"

export default function SettingsPage() {
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
                  Nenhuma sessão ativa encontrada.
                </p>
              </div>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Desconectado
              </Badge>
            </div>
          </div>
          <div className="p-4 border rounded-lg flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
            <div className="p-4 bg-muted rounded-md">
                <QrCode className="h-16 w-16 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Nenhum QR gerado ainda.</p>
            <Button>
              <QrCode className="mr-2 h-4 w-4" />
              Gerar novo QR Code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
