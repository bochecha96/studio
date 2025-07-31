"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

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
import { db } from "@/lib/firebase"
import { ArrowLeft } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  product: z.string().min(2, { message: "O nome do produto é obrigatório." }),
})

export default function NewContactPage() {
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      product: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await addDoc(collection(db, "contacts"), {
        ...values,
        status: "Pendente",
        lastContact: serverTimestamp(),
      })
      toast({
        title: "Sucesso!",
        description: "Novo contato adicionado.",
      })
      router.push("/dashboard/contacts")
    } catch (error) {
      console.error("Error adding document: ", error)
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o contato. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" asChild className="mb-4">
        <Link href="/dashboard/contacts">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Contatos
        </Link>
      </Button>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Adicionar Novo Contato</CardTitle>
          <CardDescription>
            Preencha as informações abaixo para criar um novo contato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João da Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: joao.silva@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="product"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto Comprado</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Ebook de Receitas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                 <Button type="button" variant="ghost" asChild>
                    <Link href="/dashboard/contacts">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Salvando..." : "Salvar Contato"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
