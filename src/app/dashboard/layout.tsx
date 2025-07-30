"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from 'next/navigation'
import { getAuth, onAuthStateChanged, User } from "firebase/auth"
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
  Moon,
  Loader2,
} from "lucide-react"
import { app } from "@/lib/firebase"


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = getAuth(app);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // or a login redirect component
  }
  
  let headerTitle = "Painel";
  if (pathname === '/dashboard/settings') {
    headerTitle = "Configurações";
  }

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar user={user} onLogout={handleLogout} />
        <main className="flex-1">
          <header className="flex items-center justify-between p-6 border-b">
            <h1 className="text-2xl font-semibold">{headerTitle}</h1>
          </header>
          <div>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

function AppSidebar({ user, onLogout }: { user: User, onLogout: () => void }) {
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
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center justify-between w-full cursor-pointer hover:bg-muted/50 p-2 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            {user.photoURL && <AvatarImage src={user.photoURL} />}
                            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-semibold">{user.displayName || 'Usuário'}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                     <Button variant="ghost" size="icon">
                        <Moon />
                    </Button>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
