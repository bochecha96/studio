"use client"

import { useState, useEffect } from "react"
import { getAuth, onAuthStateChanged, User } from "firebase/auth"
import { doc, onSnapshot, collection, query, where, Timestamp, getDocs } from "firebase/firestore"
import {
  startOfToday,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  TrendingUp,
  DollarSign,
  MessageSquareText,
  Loader2,
  Clock,
  XCircle,
  CheckCircle,
} from "lucide-react"
import { app, db } from "@/lib/firebase"


interface Contact {
  id: string;
  name: string;
  product: string;
  status: 'Pendente' | 'Recuperado' | 'Perdido' | 'Contatado' | 'Respondido';
}

type TimeFilter = "7d" | "currentMonth" | "lastMonth"

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const auth = getAuth(app)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("currentMonth")
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [messagesSentCount, setMessagesSentCount] = useState(0)
  const [loadingFilter, setLoadingFilter] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribeAuth()
  }, [auth])


  useEffect(() => {
    if (!user) {
      setFilteredContacts([]);
      setMessagesSentCount(0);
      setLoadingFilter(false)
      return;
    };

    setLoadingFilter(true);

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeFilter) {
      case "7d":
        startDate = subDays(startOfToday(), 6);
        break;
      case "lastMonth":
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        startDate = lastMonthStart;
        endDate = endOfMonth(lastMonthStart);
        break;
      case "currentMonth":
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const contactsQuery = query(
      collection(db, "contacts"),
      where("userId", "==", user.uid),
      where("lastContact", ">=", startTimestamp),
      where("lastContact", "<=", endTimestamp)
    );

    const messagesQuery = query(
      collection(db, "message_logs"),
      where("userId", "==", user.uid),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<=", endTimestamp)
    );

    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        product: doc.data().product,
        status: doc.data().status
      }));
      setFilteredContacts(contactsData);
    }, (error) => {
      console.error("Error fetching filtered contacts:", error);
    });

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        setMessagesSentCount(snapshot.size);
    }, (error) => {
        console.error("Error fetching message logs:", error);
    });
    
    // Set loading to false once both have been set up
    // Note: This is a simplification. For production, you might want more robust loading state management.
    setLoadingFilter(false);


    return () => {
        unsubscribeContacts();
        unsubscribeMessages();
    };
  }, [user, timeFilter]);

  
  const recoveredCount = filteredContacts.filter(c => c.status === 'Recuperado').length;
  const pendingCount = filteredContacts.filter(c => ['Pendente', 'Contatado', 'Respondido'].includes(c.status)).length;
  const lostCount = filteredContacts.filter(c => c.status === 'Perdido').length;
  const totalContactsInPeriod = filteredContacts.length;


  const renderContactsTable = (contacts: Contact[], emptyMessage: string) => {
    if (loadingFilter) {
      return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (contacts.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Produto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>{contact.name}</TableCell>
              <TableCell>{contact.product}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <div className="flex items-center space-x-2">
           <Button variant={timeFilter === '7d' ? 'default' : 'outline'} onClick={() => setTimeFilter('7d')}>7 dias</Button>
           <Button variant={timeFilter === 'currentMonth' ? 'default' : 'outline'} onClick={() => setTimeFilter('currentMonth')}>Mês Atual</Button>
           <Button variant={timeFilter === 'lastMonth' ? 'default' : 'outline'} onClick={() => setTimeFilter('lastMonth')}>Mês Anterior</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Total de Contatos
            </CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingFilter ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <div className="text-3xl font-bold">{totalContactsInPeriod}</div>
            )}
            <p className="text-xs text-muted-foreground">no período selecionado</p>
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
             {loadingFilter ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <div className="text-3xl font-bold">{recoveredCount}</div>}
             <p className="text-xs text-muted-foreground">no período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Valor Recuperado</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Funcionalidade em breve</p>
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
             {loadingFilter ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <div className="text-3xl font-bold">{messagesSentCount}</div>
              )}
             <p className="text-xs text-muted-foreground">no período selecionado</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="pendentes" className="py-2 text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({loadingFilter ? '...' : pendingCount})
          </TabsTrigger>
          <TabsTrigger value="recuperadas" className="py-2 text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Recuperadas ({loadingFilter ? '...' : recoveredCount})
          </TabsTrigger>
          <TabsTrigger value="perdidas" className="py-2 text-sm flex items-center gap-2">
             <XCircle className="h-4 w-4" />
             Perdidas ({loadingFilter ? '...' : lostCount})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
           <Card className="mt-4">
            <CardContent className="p-6 h-96 overflow-auto">
              {renderContactsTable(filteredContacts.filter(c => ['Pendente', 'Contatado', 'Respondido'].includes(c.status)), 'Nenhum contato pendente encontrado para este período.')}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="recuperadas">
          <Card className="mt-4">
            <CardContent className="p-6 h-96 overflow-auto">
                {renderContactsTable(filteredContacts.filter(c => c.status === 'Recuperado'), 'Nenhuma venda recuperada encontrada para este período.')}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="perdidas">
          <Card className="mt-4">
            <CardContent className="p-6 h-96 overflow-auto">
                {renderContactsTable(filteredContacts.filter(c => c.status === 'Perdido'), 'Nenhuma venda perdida encontrada para este período.')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
