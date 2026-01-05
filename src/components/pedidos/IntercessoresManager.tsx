import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Edit, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFilialId } from "@/hooks/useFilialId";

interface Intercessor {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  max_pedidos: number;
  pedidos_ativos?: number;
}

export function IntercessoresManager() {
  const [intercessores, setIntercessores] = React.useState<Intercessor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    max_pedidos: 10,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, hasAccess } = useAuth();
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const isLeader = !!(
    profile?.e_lider ||
    hasAccess("intercessao", "aprovar_gerenciar") ||
    hasAccess("eventos", "aprovar_gerenciar") ||
    hasAccess("eventos", "acesso_completo")
  );

  const fetchIntercessores = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("intercessores")
        .select(
          `
          *,
          pedidos_oracao!intercessor_id(count)
        `
        )
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;

      const intercessoresComContagem =
        data?.map((i) => ({
          ...i,
          pedidos_ativos: i.pedidos_oracao?.[0]?.count || 0,
        })) || [];

      setIntercessores(intercessoresComContagem);
    } catch (error) {
      console.error("Erro ao buscar intercessores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os intercessores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isLeader) {
      setLoading(false);
      return;
    }
    if (!filialLoading) {
      fetchIntercessores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeader, filialLoading, igrejaId, filialId, isAllFiliais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingId) return;

    try {
      const { error } = await supabase
        .from("intercessores")
        .update({ max_pedidos: formData.max_pedidos })
        .eq("id", editingId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações atualizadas com sucesso",
      });

      setEditingId(null);
      setDialogOpen(false);
      fetchIntercessores();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from("intercessores")
        .update({ ativo: !ativo })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Intercessor ${
          !ativo ? "ativado" : "desativado"
        } com sucesso`,
      });

      fetchIntercessores();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (intercessor: Intercessor) => {
    setEditingId(intercessor.id);
    setFormData({
      max_pedidos: intercessor.max_pedidos,
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando intercessores...</p>
      </div>
    );
  }

  if (!isLeader) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Gerenciar Intercessores
            </h2>
            <p className="text-sm text-muted-foreground">
              Apenas líderes podem gerenciar intercessores e equipes
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Você precisa ser líder para acessar estas configurações. Se acredita
            que é um erro, fale com um administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">
            Gerenciar Intercessores
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure status e limite de pedidos dos intercessores
          </p>
        </div>
        <Button onClick={() => navigate("/eventos/times?focus=intercessao")}>
          <Users className="w-4 h-4 mr-2" />
          Gerenciar Equipe
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Para adicionar novos intercessores, adicione-os ao time "Intercessão"
          no menu de <strong>Equipes/Escalas</strong>. A sincronização é
          automática.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Intercessores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {intercessores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum intercessor cadastrado.</p>
              <p className="text-sm mt-2">
                Adicione membros ao time "Intercessão" para que apareçam aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Contato
                  </TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Máx.</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intercessores.map((intercessor) => (
                  <TableRow key={intercessor.id}>
                    <TableCell className="font-medium">
                      {intercessor.nome}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-sm text-muted-foreground">
                        {intercessor.email && <div>{intercessor.email}</div>}
                        {intercessor.telefone && (
                          <div>{intercessor.telefone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          intercessor.pedidos_ativos! >= intercessor.max_pedidos
                            ? "destructive"
                            : "default"
                        }
                      >
                        {intercessor.pedidos_ativos}
                      </Badge>
                    </TableCell>
                    <TableCell>{intercessor.max_pedidos}</TableCell>
                    <TableCell>
                      <Switch
                        checked={intercessor.ativo}
                        onCheckedChange={() =>
                          handleToggleAtivo(intercessor.id, intercessor.ativo)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(intercessor)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Intercessor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_pedidos">Máximo de Pedidos Simultâneos</Label>
              <Input
                id="max_pedidos"
                type="number"
                min="1"
                value={formData.max_pedidos}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_pedidos: parseInt(e.target.value) || 1,
                  })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Define quantos pedidos de oração este intercessor pode receber
                simultaneamente.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
