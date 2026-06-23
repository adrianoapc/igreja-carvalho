import { Outlet } from "react-router-dom";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import { CookieBanner } from "./CookieBanner";

export default function PublicLayout() {
  return (
    <CookieConsentProvider>
      <div className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded focus:bg-pub-gold focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-pub-bark focus:outline-none"
        >
          Pular para o conteúdo
        </a>
        <PublicHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 pt-16 outline-none">
          <Outlet />
        </main>
        <PublicFooter />
        {/* Banner fixo na base — só aparece enquanto consent === "pending" */}
        <CookieBanner />
      </div>
    </CookieConsentProvider>
  );
}
