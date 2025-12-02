import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Biblia() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/public")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Bíblia</h1>
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <iframe
          src="https://www.bible.com/pt/bible/211/GEN.1.NTLH"
          className="w-full h-full border-0"
          style={{ minHeight: "calc(100vh - 120px)" }}
          title="Bíblia YouVersion"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
