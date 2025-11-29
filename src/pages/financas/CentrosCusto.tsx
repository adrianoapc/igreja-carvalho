import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function CentrosCusto() {
  const navigate = useNavigate();

  const { data: centros, isLoading } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centros_custo')
        .select(`
          *,
          base_ministerial:base_ministerial_id(titulo)
        `)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financas')}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Centros de Custo</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Áreas que demandam entrada e saída de recursos</p>
          </div>
          <Button className="bg-gradient-primary shadow-soft">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Centro</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando centros de custo...</p>
          </CardContent>
        </Card>
      ) : centros && centros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {centros.map((centro) => (
            <Card key={centro.id} className="shadow-soft">
              <CardContent className="p-4 md:p-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base md:text-lg font-semibold text-foreground">{centro.nome}</h3>
                    <Badge variant="secondary" className="text-xs">Ativo</Badge>
                  </div>
                  {centro.descricao && (
                    <p className="text-sm text-muted-foreground">{centro.descricao}</p>
                  )}
                  {centro.base_ministerial && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Base: <span className="font-medium">{centro.base_ministerial.titulo}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhum centro de custo cadastrado ainda. Ex: Ministério Infantil, Mídia, Missões, etc.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
