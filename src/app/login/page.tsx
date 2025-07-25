import { MessageSquare } from "lucide-react"
import Link from "next/link"

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

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">RecuperaVendas</h1>
          </div>
          <CardTitle className="text-2xl">Acesse sua conta</CardTitle>
          <CardDescription>
            Use suas credenciais para entrar no painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
            <div className="mt-4 text-center text-sm">
              <Link href="#" className="underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
