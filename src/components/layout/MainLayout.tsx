import * as React from "react";
import { ReactNode, useRef, useEffect, useState } from "react";
import { Outlet } from "react-router-dom"; 
import { AppSidebar } from "./Sidebar";
// Removed: UserMenu import is no longer needed here
import NotificationsBell from "./NotificationsBell";
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { useSwipeElement } from "@/hooks/useSwipe";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import { HideValuesProvider } from "@/hooks/useHideValues"; 
import { Separator } from "@/components/ui/separator"; // Importe o Separator
import { AppBreadcrumb } from "./AppBreadcrumb"; // Importe o novo componente
interface MainLayoutProps {
  children?: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { open, setOpen } = useSidebar();
  const mainRef = useRef<HTMLDivElement>(null);

  useSwipeElement(mainRef, {
    onSwipeRight: () => {
      if (!open) setOpen(true);
    },
    onSwipeLeft: () => {
      if (open) setOpen(false);
    },
    threshold: 80,
  });

  return (
    <>
      <div className="relative z-50">
        <AppSidebar />
      </div>
      
      <SidebarInset className="flex-1 min-w-0 relative z-0">
        <header
          className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          style={{ paddingTop: "var(--safe-area-top)" }}
        >
          <div className="flex h-14 md:h-16 items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex items-center gap-4">
                  <SidebarTrigger />
                  <Separator orientation="vertical" className="h-6 hidden md:block" />
                  <AppBreadcrumb />
                </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <NotificationsBell />
              {/* UserMenu removido daqui pois já está na Sidebar */}
            </div>
          </div>
        </header>
        
        <main
          ref={mainRef}
          className="p-4 md:p-8 min-w-0"
          style={{ paddingBottom: "var(--safe-area-bottom)" }}
        >
          {children}
          <Outlet /> 
        </main>
      </SidebarInset>
    </>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, isAuthenticated, loading } = useAuth();
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);

  useEffect(() => {
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
      <HideValuesProvider>
        <div
          className="min-h-screen flex w-full bg-background"
          style={{ paddingTop: "var(--safe-area-top)", paddingBottom: "var(--safe-area-bottom)" }}
        >
          <MainLayoutContent>{children}</MainLayoutContent>
        </div>
        
        <RegistrarSentimentoDialog 
          open={sentimentoDialogOpen} 
          onOpenChange={setSentimentoDialogOpen} 
        />
      </HideValuesProvider>
    </SidebarProvider>
  );
}