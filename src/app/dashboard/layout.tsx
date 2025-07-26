"use client"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  MessageSquare,
  LayoutGrid,
  Users,
  Settings,
  LogOut,
  AlertTriangle,
  Moon
} from "lucide-react"


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  let headerTitle = "Painel";
  if (pathname === '/dashboard/settings') {
    headerTitle = "Configurações";
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <h1 className="text-2xl font-semibold">{headerTitle}</h1>
          </header>
          <div className="p-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

function AppSidebar() {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-8 h-8 text-primary" />
          <h2 className="text-xl font-semibold">RecuperaVendas</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/dashboard" asChild isActive={pathname === '/dashboard'}>
              <Link href="/dashboard">
                <LayoutGrid />
                Painel
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" asChild>
              <Link href="#">
                <Users />
                Contatos
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/dashboard/settings" asChild isActive={pathname === '/dashboard/settings'}>
              <Link href="/dashboard/settings">
                <Settings />
                Configurações
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton href="#" asChild>
              <Link href="#">
                <AlertTriangle />
                Status do Sistema
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold">Usuário</span>
                    <span className="text-xs text-muted-foreground">usuario@exemplo.com</span>
                </div>
            </div>
            <Button variant="ghost" size="icon">
                <Moon />
            </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
