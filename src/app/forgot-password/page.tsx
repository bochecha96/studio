"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getAuth, sendPasswordResetEmail } from "firebase/auth"
import { ArrowLeft, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { app } from "@/lib/firebase"

const formSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
})

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth(app)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await sendPasswordResetEmail(auth, values.email)
      setIsSubmitted(true)
    } catch (error: any) {
      // We don't want to reveal if an email exists or not for security reasons.
      // So we show a generic success message even in case of 'auth/user-not-found'.
      if (error.code === 'auth/user-not-found') {
        setIsSubmitted(true);
      } else {
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao enviar o e-mail. Tente novamente.",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-6">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">RecuperaVendas</h1>
          </div>
          <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
          {!isSubmitted && (
             <CardDescription>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
             </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                    Se um conta com este e-mail existir, um link de redefinição de senha foi enviado. Verifique sua caixa de entrada e spam.
                </p>
                <Button variant="outline" asChild>
                    <Link href="/login">
                        <ArrowLeft className="mr-2" />
                        Voltar para o Login
                    </Link>
                </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
                </Button>
                 <Button variant="link" className="w-full" asChild>
                    <Link href="/login">Voltar para o Login</Link>
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
