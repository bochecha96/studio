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
} from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">7 dias</Button>
          <Button variant="default" size="sm">Mês Atual</Button>
          <Button variant="outline" size="sm">Mês Anterior</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Vendas
            </CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendas Recuperadas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Recuperado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mensagens Enviadas
            </CardTitle>
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="recuperadas">Recuperadas</TabsTrigger>
          <TabsTrigger value="perdidas">Perdidas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <div className="flex items-center justify-center p-6 h-48 border rounded-lg bg-card text-card-foreground shadow-sm">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
        <TabsContent value="recuperadas">
          <div className="flex items-center justify-center p-6 h-48 border rounded-lg bg-card text-card-foreground shadow-sm">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
        <TabsContent value="perdidas">
          <div className="flex items-center justify-center p-6 h-48 border rounded-lg bg-card text-card-foreground shadow-sm">
            <p className="text-muted-foreground">Nenhuma venda encontrada para este status e período.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
