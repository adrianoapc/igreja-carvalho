import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Users, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PosicaoDialog from "@/components/cultos/PosicaoDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Posicao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  time_id: string;
  time: {
    id: string;
    nome: string;
    cor: string;
  };
}

export default function Posicoes() {
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [posicaoEditando, setPosicaoEditando] = useState<Posicao | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [posicaoDeletar, setPosicaoDeletar] = useState<Posicao | null>(null);

  useEffect(() => {
    loadPosicoes();
  }, []);

  const loadPosicoes = async () => {
    try {
      const { data, error } = await supabase
        .from("posicoes_time")
        .select(`
          *,
          time:times(id, nome, cor)
        `)
        .order("nome", { ascending: true });

      if (error) throw error;
      setPosicoes(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar posições", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNovaPosicao = () => {
    setPosicaoEditando(null);
    setDialogOpen(true);
  };

  const handleEditarPosicao = (posicao: Posicao) => {
    setPosicaoEditando(posicao);
    setDialogOpen(true);
  };

  const handleDeletarPosicao = (posicao: Posicao) => {
    setPosicaoDeletar(posicao);
    setDeleteDialogOpen(true);
  };

  const confirmarDelecao = async () => {
    if (!posicaoDeletar) return;

    try {
      // Verificar se existem membros ou escalas com esta posição
      const { count: membrosCount } = await supabase
        .from("membros_time")
        .select("*", { count: "exact", head: true })
        .eq("posicao_id", posicaoDeletar.id);

      const { count: escalasCount } = await supabase
        .from("escalas")
        .select("*", { count: "exact", head: true })
        .eq("posicao_id", posicaoDeletar.id);

      if ((membrosCount || 0) > 0 || (escalasCount || 0) > 0) {
        toast.error("Não é possível deletar esta posição", {
          description: "Existem membros ou escalas vinculados a esta posição. Remova os vínculos primeiro ou desative a posição."
        });
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("posicoes_time")
        .delete()
        .eq("id", posicaoDeletar.id);

      if (error) throw error;

      toast.success("Posição deletada com sucesso!");
      loadPosicoes();
    } catch (error: unknown) {
      toast.error("Erro ao deletar posição", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setDeleteDialogOpen(false);
      setPosicaoDeletar(null);
    }
  };

  const handleDialogSuccess = () => {
    loadPosicoes();
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Posições</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Carregando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Agrupar por time
  const posicoesPorTime = posicoes.reduce((acc, pos) => {
    const timeId = pos.time.id;
    if (!acc[timeId]) {
      acc[timeId] = {
        time: pos.time,
        posicoes: []
      };
    }
    acc[timeId].posicoes.push(pos);
    return acc;
  }, {} as Record<string, { time: { id: string; nome: string }; posicoes: Posicao[] }>);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Posições dos Times</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as posições de cada time
          </p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={handleNovaPosicao}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Posição
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6">
        {Object.values(posicoesPorTime).map(({ time, posicoes }) => (
          <Card key={time.id} className="shadow-soft">
            <CardHeader className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: time.cor }}
                >
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">{time.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {posicoes.length} {posicoes.length === 1 ? "posição" : "posições"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                {posicoes.map((posicao) => (
                  <div 
                    key={posicao.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <UserCog className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{posicao.nome}</p>
                        <Badge variant={posicao.ativo ? "default" : "secondary"} className="text-xs">
                          {posicao.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {posicao.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {posicao.descricao}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleEditarPosicao(posicao)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeletarPosicao(posicao)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Deletar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(posicoesPorTime).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <UserCog className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma posição cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece criando a primeira posição para seus times.
              </p>
              <Button onClick={handleNovaPosicao}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Posição
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <PosicaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        posicao={posicaoEditando}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a posição <strong>{posicaoDeletar?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita. Se houver membros ou escalas vinculados a esta posição, você precisará removê-los primeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarDelecao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}