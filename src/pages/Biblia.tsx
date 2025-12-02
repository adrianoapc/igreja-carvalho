import { PublicHeader } from "@/components/layout/PublicHeader";

export default function Biblia() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton title="Bíblia" subtitle="Leia a Palavra de Deus" />
      
      <div className="flex-1 w-full">
        <iframe
          src="https://www.bible.com/pt/bible/211/GEN.1.NTLH"
          className="w-full h-full border-0"
          style={{ minHeight: "calc(100vh - 72px)" }}
          title="Bíblia YouVersion"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
