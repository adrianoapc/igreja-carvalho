import * as React from "react";
import { ReactNode, useRef, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./Sidebar";
import NotificationsBell from "./NotificationsBell";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSwipeElement } from "@/hooks/useSwipe";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import { HideValuesProvider } from "@/hooks/useHideValues";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumb } from "./AppBreadcrumb";
import { MobileNavbar } from "./MobileNavbar"; // ✅ Nova Importação

interface MainLayoutProps {
  children?: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const { open, setOpen } = useSidebar();
  const mainRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Rotas onde queremos esconder a Navbar Mobile (ex: Check-in, Players, Telão)
  const hideMobileNavRoutes = [
    "/checkin",
    "/telao",
    "/player",
    "/liturgia-player",
  ];
  const shouldShowMobileNav = !hideMobileNavRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  // Gesto para abrir Sidebar no Desktop/Tablet (no mobile usamos a bottom bar)
  useSwipeElement(mainRef, {
    onSwipeRight: () => {
      // Só abre sidebar via swipe em telas maiores, pois mobile tem nav própria
      if (window.innerWidth >= 768 && !open) setOpen(true);
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

      <SidebarInset className="flex-1 min-w-0 relative z-0 flex flex-col bg-background/95">
        <header
          className="sticky top-0 z-40 flex h-14 md:h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-8"
          style={{ paddingTop: "var(--safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-4">
            {/* SidebarTrigger visível apenas em Desktop agora */}
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>
            {/* Em mobile, mostramos logo ou título, mas o Breadcrumb funciona bem */}
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <AppBreadcrumb />
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <NotificationsBell />
          </div>
        </header>

        <main
          ref={mainRef}
          className="flex-1 overflow-x-hidden p-4 md:p-8 min-w-0"
          style={{
            // ✅ Padding extra em baixo para a BottomBar no mobile
            paddingBottom: shouldShowMobileNav
              ? `calc(4.5rem + var(--safe-area-inset-bottom))`
              : `1rem`,
            paddingLeft: "max(1rem, var(--safe-area-inset-left))",
            paddingRight: "max(1rem, var(--safe-area-inset-right))",
          }}
        >
          {children}
          <Outlet />
        </main>

        {/* ✅ Navbar Mobile Fixa */}
        {shouldShowMobileNav && <MobileNavbar />}
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
    <SidebarProvider defaultOpen={true}>
      <HideValuesProvider>
        <div
          className="min-h-screen flex w-full bg-background"
          style={{
            paddingTop: "var(--safe-area-top)",
            paddingBottom: "var(--safe-area-bottom)",
          }}
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
