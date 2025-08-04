"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useEffect, useState, useCallback } from "react"
import { getAuth, onAuthStateChanged, User } from "firebase/auth"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { app, db } from "@/lib/firebase"
import { ArrowLeft, Loader2 } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  phone: z.string().optional(),
  product: z.string().min(2, { message: "O nome do produto é obrigatório." }),
  status: z.enum(["Pendente", "Recuperado", "Perdido", "Contatado", "Respondido"]),
})

export default function EditContactPage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params
  const { toast } = useToast()
  const auth = getAuth(app)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      product: "",
      status: "Pendente",
    },
  })

  const fetchContact = useCallback(async (contactId: string, currentUser: User) => {
    try {
      const contactRef = doc(db, "contacts", contactId)
      const contactSnap = await getDoc(contactRef)

      if (contactSnap.exists()) {
        const contactData = contactSnap.data()
        if (contactData.userId === currentUser.uid) {
          form.reset(contactData)
        } else {
          toast({ title: "Erro", description: "Você não tem permissão para editar este contato.", variant: "destructive"})
          router.push("/dashboard/contacts")
        }
      } else {
        toast({ title: "Erro", description: "Contato não encontrado.", variant: "destructive"})
        router.push("/dashboard/contacts")
      }
    } catch (error) {
      console.error("Error fetching contact: ", error)
      toast({ title: "Erro", description: "Não foi possível carregar os dados do contato.", variant: "destructive"})
    } finally {
      setLoading(false)
    }
  }, [form, router, toast])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        if (typeof id === 'string') {
          fetchContact(id, currentUser)
        } else {
            router.push('/dashboard/contacts')
        }
      } else {
        router.push('/login')
      }
    })
    return () => unsubscribe()
  }, [auth, router, id, fetchContact])

  async function onSubmit(values: z.infer<typeof formSchema>) {
     if (!user || typeof id !== 'string') {
      toast({ title: "Erro", description: "Ação inválida.", variant: "destructive"})
      return
    }

    try {
      const contactRef = doc(db, "contacts", id)
      await updateDoc(contactRef, {
        ...values,
        lastContact: serverTimestamp(),
      })
      toast({
        title: "Sucesso!",
        description: "Contato atualizado.",
      })
      router.push("/dashboard/contacts")
    } catch (error) {
      console.error("Error updating document: ", error)
      toast({ title: "Erro", description: "Não foi possível atualizar o contato. Tente novamente.", variant: "destructive"})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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
          <CardTitle>Editar Contato</CardTitle>
          <CardDescription>
            Atualize as informações do contato abaixo.
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: (11) 99999-9999" {...field} />
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
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status do contato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Contatado">Contatado</SelectItem>
                          <SelectItem value="Respondido">Respondido</SelectItem>
                          <SelectItem value="Recuperado">Recuperado</SelectItem>
                          <SelectItem value="Perdido">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                 <Button type="button" variant="ghost" asChild>
                    <Link href="/dashboard/contacts">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
