import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import NotificationsBell from "./NotificationsBell";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-end gap-4 px-8">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
