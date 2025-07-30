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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="lg">7 dias</Button>
            <Button variant="default" size="lg">Mês Atual</Button>
            <Button variant="outline" size="lg">Mês Anterior</Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Total de Vendas
              </CardTitle>
              <Box className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Vendas Recuperadas
              </CardTitle>
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Valor Recuperado</CardTitle>
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">R$ 0,00</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Mensagens Enviadas
              </CardTitle>
              <MessageSquareText className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pendentes">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="pendentes" className="py-2 text-base">Pendentes</TabsTrigger>
            <TabsTrigger value="recuperadas" className="py-2 text-base">Recuperadas</TabsTrigger>
            <TabsTrigger value="perdidas" className="py-2 text-base">Perdidas</TabsTrigger>
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
    </div>
  )
}
