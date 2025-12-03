import * as React from "react";
import { ReactNode, useRef } from "react";
import { AppSidebar } from "./Sidebar";
import UserMenu from "./UserMenu";
import NotificationsBell from "./NotificationsBell";
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { useSwipeElement } from "@/hooks/useSwipe";

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
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <MainLayoutContent>{children}</MainLayoutContent>
      </div>
    </SidebarProvider>
  );
}
