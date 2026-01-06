import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function WelcomeHeader() {
  const { profile } = useAuth();
  const [userName, setUserName] = useState("Membro");
  const firstName = profile?.nome?.split(" ")[0] || "Usuário";
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    // 1. Pegar o nome do usuário
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Tenta pegar do metadata (nome) ou email
        const name = user.user_metadata?.nome || user.email?.split('@')[0];
        // Pega só o primeiro nome
        setUserName(name?.split(' ')[0] || "Membro");

        
      }
    };
    getUser();

    // 2. Definir saudação baseada na hora
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  return (
    <div className="flex flex-col gap-1 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {greeting}, {firstName}.
      </h1>
      <p className="text-muted-foreground">
        Que bom te ver por aqui! Confira as novidades de hoje, {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
      </p>
    </div>
  );
}