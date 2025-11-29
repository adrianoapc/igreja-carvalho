import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function BasesMinisteriais() {
  const navigate = useNavigate();

  const { data: bases, isLoading } = useQuery({
    queryKey: ['bases-ministeriais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bases_ministeriais')
        .select(`
          *,
          responsavel:responsavel_id(nome)
        `)
        .eq('ativo', true)
        .order('titulo');
      
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bases Ministeriais</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Unidades de negócio da igreja</p>
          </div>
          <Button className="bg-gradient-primary shadow-soft">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Base</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando bases ministeriais...</p>
          </CardContent>
        </Card>
      ) : bases && bases.length > 0 ? (
        <div className="space-y-3">
          {bases.map((base) => (
            <Card key={base.id} className="shadow-soft">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{base.titulo}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{base.descricao}</p>
                    {base.responsavel && (
                      <div className="flex items-center gap-2 mt-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Responsável: {base.responsavel.nome}
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">Ativa</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhuma base ministerial cadastrada ainda. Ex: Base de Evangelismo, Base de Comunhão, etc.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
