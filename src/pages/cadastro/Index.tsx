import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Users, UserPlus, Heart, Coffee } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";

export default function CadastroIndex() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [igrejaInfo, setIgrejaInfo] = useState({ nome: "Igreja Carvalho", subtitulo: "" });
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  
  const aceitouJesus = searchParams.get("aceitou") === "true";
  const igrejaIdParam = searchParams.get("igreja_id");
  const filialIdParam = searchParams.get("filial_id");
  const todasFiliaisParam = searchParams.get("todas_filiais");
  const igrejaContexto = igrejaIdParam || igrejaId;

  const buildCadastroPath = (path: string, includeAceitou = false) => {
    const params = new URLSearchParams();
    if (igrejaIdParam) params.set("igreja_id", igrejaIdParam);
    if (filialIdParam) params.set("filial_id", filialIdParam);
    if (todasFiliaisParam === "true") params.set("todas_filiais", "true");
    if (includeAceitou && aceitouJesus) params.set("aceitou", "true");
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  useEffect(() => {
    const fetchIgrejaInfo = async () => {
      if (!igrejaContexto) {
        return;
      }

      const { data } = await supabase
        .from("configuracoes_igreja")
        .select("*")
        .eq("igreja_id", igrejaContexto)
        .maybeSingle();
      if (data) {
        setIgrejaInfo({ nome: data.nome_igreja, subtitulo: data.subtitulo || "" });
      }
    };
    if (!igrejaLoading) {
      fetchIgrejaInfo();
    }
  }, [igrejaContexto, igrejaLoading]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton backTo="/public" />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Bem-vindo(a)!
            </CardTitle>
            <CardDescription className="text-base">
              Ajude a {igrejaInfo.nome} a te conhecer melhor preenchendo seu perfil.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {aceitouJesus && (
              <div className="p-4 bg-primary/10 rounded-lg text-center mb-4">
                <Heart className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">
                  Que alegria saber que você aceitou Jesus! 🎉
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Membro</h3>
                <p className="text-sm text-muted-foreground">
                  Se você é membro da igreja, mantenha seus dados de cadastro atualizados aqui.
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate(buildCadastroPath("/cadastro/membro"))}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Atualizar meu perfil de membro
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Visitante</h3>
                <p className="text-sm text-muted-foreground">
                  Se você é visitante da igreja, deixe seu nome e contato aqui.
                </p>
                <Button 
                  variant="outline"
                  className="w-full" 
                  onClick={() => navigate(buildCadastroPath("/cadastro/visitante", true))}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Cadastrar como visitante
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-orange-200/60 dark:border-orange-800/40 p-3 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-pink-500/10">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-orange-600" />
                  Café V&P
                </h3>
                <p className="text-sm text-muted-foreground">
                  Recepção e alinhamento de novos membros. Preencha seu cadastro em formato guiado.
                </p>
                <Button
                  className="w-full"
                  onClick={() => navigate(buildCadastroPath("/cadastro/cafe-vp"))}
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Preencher cadastro Café V&P
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
