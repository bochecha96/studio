"use client"
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Search, Upload, PlusCircle, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"
import { app, db } from '@/lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';


interface Contact {
  id: string;
  name: string;
  email: string;
  product: string;
  status: 'Recuperado' | 'Pendente' | 'Perdido';
  lastContact: Date;
  userId: string;
}

const StatusBadge = ({ status }: { status: Contact['status'] }) => {
  switch (status) {
    case 'Recuperado':
      return (
        <Badge variant="outline" className="text-green-500 border-green-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    case 'Pendente':
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {status}
        </Badge>
      );
    case 'Perdido':
      return (
        <Badge variant="outline" className="text-red-500 border-red-500 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};


export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user) {
        // No user, clear contacts and stop loading
        setContacts([]);
        setLoading(false);
        return;
    };

    setLoading(true);
    const q = query(
        collection(db, 'contacts'), 
        where('userId', '==', user.uid),
        orderBy('lastContact', 'desc')
    );

    const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
      const contactsData: Contact[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        contactsData.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          product: data.product,
          status: data.status,
          lastContact: data.lastContact.toDate(),
          userId: data.userId
        });
      });
      setContacts(contactsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching contacts: ", error);
      setLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) {
      return contacts;
    }
    return contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contacts, searchTerm]);
  
  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Contatos</h2>
        <p className="text-muted-foreground">
          Gerencie seus contatos e veja o status deles.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar contatos..." 
            className="pl-10" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button asChild>
            <Link href="/dashboard/contacts/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Contato
            </Link>
          </Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data do Último Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                       <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{contact.product}</TableCell>
                  <TableCell>
                    <StatusBadge status={contact.status} />
                  </TableCell>
                  <TableCell>
                    {format(contact.lastContact, "dd 'de' MMM. 'de' yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
                 <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        {user ? 'Nenhum contato encontrado.' : 'Faça login para ver seus contatos.'}
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
