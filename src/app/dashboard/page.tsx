"use client"

import { useState, useEffect } from "react"
import { getAuth, onAuthStateChanged, User } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Box,
  TrendingUp,
  DollarSign,
  MessageSquareText,
  Loader2,
} from "lucide-react"
import { app, db } from "@/lib/firebase"

interface UserStats {
  messagesSent: number;
  // Add other stats here in the future
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const auth = getAuth(app)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        setLoading(false)
        setStats(null)
      }
    })
    return () => unsubscribeAuth()
  }, [auth])

  useEffect(() => {
    if (!user) return

    setLoading(true)
    const statsRef = doc(db, "user_stats", user.uid)
    const unsubscribeStats = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data() as UserStats)
      } else {
        setStats({ messagesSent: 0 }) // Default stats if none exist
      }
      setLoading(false)
    }, (error) => {
      console.error("Error fetching user stats:", error)
      setStats({ messagesSent: 0 })
      setLoading(false)
    })

    return () => unsubscribeStats()
  }, [user])

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline">7 dias</Button>
          <Button variant="default">Mês Atual</Button>
          <Button variant="outline">Mês Anterior</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Total de Vendas
            </CardTitle>
            <Box className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Vendas Recuperadas
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Valor Recuperado</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">R$ 0,00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Mensagens Enviadas
            </CardTitle>
            <MessageSquareText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div className="text-3xl font-bold">{stats?.messagesSent ?? 0}</div>
              )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="pendentes" className="py-2 text-sm">Pendentes</TabsTrigger>
          <TabsTrigger value="recuperadas" className="py-2 text-sm">Recuperadas</TabsTrigger>
          <TabsTrigger value="perdidas" className="py-2 text-sm">Perdidas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <div className="flex items-center justify-center p-6 h-96 border rounded-lg bg-card text-card-foreground shadow-sm mt-4">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
        <TabsContent value="recuperadas">
          <div className="flex items-center justify-center p-6 h-96 border rounded-lg bg-card text-card-foreground shadow-sm mt-4">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
        <TabsContent value="perdidas">
          <div className="flex items-center justify-center p-6 h-96 border rounded-lg bg-card text-card-foreground shadow-sm mt-4">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
