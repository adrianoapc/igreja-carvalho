import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Loader2, UserCheck, User, UserPlus } from "lucide-react";
import { AdicionarFamiliarDialog } from "./AdicionarFamiliarDialog";
import { ConverterFamiliarDialog } from "./ConverterFamiliarDialog";
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

interface Familiar {
  id: string;
  familiar_id: string | null;
  nome_familiar: string | null;
  tipo_parentesco: string;
  familiar?: {
    id: string;
    nome: string;
    status: string;
  };
}

interface FamiliaresSectionProps {
  pessoaId: string;
  pessoaNome: string;
}

const PARENTESCO_LABELS: Record<string, string> = {
  conjuge: "Cônjuge",
  filho: "Filho(a)",
  pai: "Pai",
  mae: "Mãe",
  irmao: "Irmão(ã)",
  avo: "Avô(ó)",
  neto: "Neto(a)",
  tio: "Tio(a)",
  sobrinho: "Sobrinho(a)",
  primo: "Primo(a)",
  outro: "Outro",
};

export function FamiliaresSection({ pessoaId, pessoaNome }: FamiliaresSectionProps) {
  const [familiares, setFamiliares] = useState<Familiar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [familiarParaDeletar, setFamiliarParaDeletar] = useState<string | null>(null);
  const [familiarParaConverter, setFamiliarParaConverter] = useState<{ id: string; nome: string } | null>(null);
  const [deletando, setDeletando] = useState(false);
  const { toast } = useToast();

  const fetchFamiliares = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("familias")
        .select(`
          id,
          familiar_id,
          nome_familiar,
          tipo_parentesco,
          familiar:profiles!familias_familiar_id_fkey (
            id,
            nome,
            status
          )
        `)
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setFamiliares(data || []);
    } catch (error) {
      console.error("Erro ao buscar familiares:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os familiares",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamiliares();
  }, [pessoaId]);

  const handleDeletar = async () => {
    if (!familiarParaDeletar) return;

    setDeletando(true);
    try {
      const { error } = await supabase
        .from("familias")
        .delete()
        .eq("id", familiarParaDeletar);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Familiar removido com sucesso",
      });

      fetchFamiliares();
    } catch (error) {
      console.error("Erro ao deletar familiar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o familiar",
        variant: "destructive",
      });
    } finally {
      setDeletando(false);
      setFamiliarParaDeletar(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "membro":
        return "default";
      case "frequentador":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "membro":
        return "Membro";
      case "frequentador":
        return "Frequentador";
      default:
        return "Visitante";
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-green-600 rounded" />
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Família
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Familiar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : familiares.length > 0 ? (
            <div className="space-y-3">
              {familiares.map((familiar) => (
                <div
                  key={familiar.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {familiar.familiar_id ? (
                        <UserCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="font-medium truncate">
                        {familiar.familiar_id 
                          ? familiar.familiar?.nome 
                          : familiar.nome_familiar}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 ml-6">
                      <Badge variant="outline" className="text-xs">
                        {PARENTESCO_LABELS[familiar.tipo_parentesco] || familiar.tipo_parentesco}
                      </Badge>
                      {familiar.familiar_id && familiar.familiar && (
                        <Badge variant={getStatusBadgeVariant(familiar.familiar.status)} className="text-xs">
                          {getStatusLabel(familiar.familiar.status)}
                        </Badge>
                      )}
                      {!familiar.familiar_id && (
                        <Badge variant="secondary" className="text-xs">
                          Não cadastrado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!familiar.familiar_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFamiliarParaConverter({ id: familiar.id, nome: familiar.nome_familiar || "" })}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Converter em cadastro completo"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFamiliarParaDeletar(familiar.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum familiar cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AdicionarFamiliarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pessoaId={pessoaId}
        pessoaNome={pessoaNome}
        onSuccess={fetchFamiliares}
      />

      {familiarParaConverter && (
        <ConverterFamiliarDialog
          open={!!familiarParaConverter}
          onOpenChange={(open) => !open && setFamiliarParaConverter(null)}
          familiaId={familiarParaConverter.id}
          nomeFamiliar={familiarParaConverter.nome}
          onSuccess={fetchFamiliares}
        />
      )}

      <AlertDialog open={!!familiarParaDeletar} onOpenChange={(open) => !open && setFamiliarParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover familiar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este familiar? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletar}
              disabled={deletando}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
