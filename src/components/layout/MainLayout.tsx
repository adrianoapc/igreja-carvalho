import * as React from "react";
import { ReactNode, useRef, useEffect, useState } from "react";
import { AppSidebar } from "./Sidebar";
import UserMenu from "./UserMenu";
import NotificationsBell from "./NotificationsBell";
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { useSwipeElement } from "@/hooks/useSwipe";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { open, setOpen } = useSidebar();
  const mainRef = useRef<HTMLDivElement>(null);

  // Gesto de swipe para abrir/fechar sidebar
  useSwipeElement(mainRef, {
    onSwipeRight: () => {
      if (!open) {
        setOpen(true);
      }
    },
    onSwipeLeft: () => {
      if (open) {
        setOpen(false);
      }
    },
    threshold: 80,
  });

  return (
    <>
      {/* Sidebar com z-index alto para ficar sempre acima */}
      <div className="relative z-50">
        <AppSidebar />
      </div>
      
      {/* Conteúdo principal com z-index inferior e overflow isolado */}
      <SidebarInset className="flex-1 min-w-0 relative z-0">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 md:h-16 items-center justify-between gap-4 px-4 md:px-8">
            <SidebarTrigger>
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            
            <div className="flex items-center gap-2 md:gap-4">
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
        </header>
        
        <main ref={mainRef} className="p-4 md:p-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { profile, isAuthenticated, loading } = useAuth();
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);

  useEffect(() => {
    // Verificar se o usuário já registrou sentimento hoje
    const checkTodaySentimento = async () => {
      if (!isAuthenticated || !profile?.id || loading || checkedToday) return;

      try {
        const today = new Date();
        const dayStart = startOfDay(today).toISOString();
        const dayEnd = endOfDay(today).toISOString();

        const { data, error } = await supabase
          .from("sentimentos_membros")
          .select("id")
          .eq("pessoa_id", profile.id)
          .gte("data_registro", dayStart)
          .lte("data_registro", dayEnd)
          .limit(1);

        if (error) {
          console.error("Erro ao verificar sentimento:", error);
          return;
        }

        setCheckedToday(true);

        // Se não votou hoje, abre o dialog
        if (!data || data.length === 0) {
          setSentimentoDialogOpen(true);
        }
      } catch (error) {
        console.error("Erro ao verificar sentimento:", error);
      }
    };

    checkTodaySentimento();
  }, [isAuthenticated, profile?.id, loading, checkedToday]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <MainLayoutContent>{children}</MainLayoutContent>
      </div>
      
      {/* Dialog de verificação diária de sentimento */}
      <RegistrarSentimentoDialog 
        open={sentimentoDialogOpen} 
        onOpenChange={setSentimentoDialogOpen} 
      />
    </SidebarProvider>
  );
}
