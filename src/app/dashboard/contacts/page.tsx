
"use client"
import React from 'react';
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
import { Search, Upload, PlusCircle, CheckCircle, Clock, XCircle } from "lucide-react"

const contacts = [
  {
    name: "Alice Johnson",
    email: "alice@example.com",
    product: "Ebook 'JavaScript Avançado'",
    status: "Recuperado",
    lastContact: "28 de jul. de 2024",
    initials: "AJ",
  },
  {
    name: "Bob Williams",
    email: "bob@example.com",
    product: "Curso Online 'Mestres do React'",
    status: "Pendente",
    lastContact: "28 de jul. de 2024",
    initials: "BW",
  },
  {
    name: "Charlie Brown",
    email: "charlie@example.com",
    product: "Assinatura 'Ferramentas de Design Pro'",
    status: "Pendente",
    lastContact: "27 de jul. de 2024",
    initials: "CB",
  },
  {
    name: "Diana Miller",
    email: "diana@example.com",
    product: "Ebook 'JavaScript Avançado'",
    status: "Perdido",
    lastContact: "27 de jul. de 2024",
    initials: "DM",
  },
  {
    name: "Ethan Davis",
    email: "ethan@example.com",
    product: "Curso Online 'Mestres do React'",
    status: "Recuperado",
    lastContact: "26 de jul. de 2024",
    initials: "ED",
  },
  {
    name: "Fiona Garcia",
    email: "fiona@example.com",
    product: "Assinatura 'Ferramentas de Design Pro'",
    status: "Recuperado",
    lastContact: "26 de jul. de 2024",
    initials: "FG",
  },
]

const StatusBadge = ({ status }: { status: string }) => {
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
          <Input placeholder="Buscar contatos..." className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Contato
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
            {contacts.map((contact, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{contact.initials}</AvatarFallback>
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
                <TableCell>{contact.lastContact}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
