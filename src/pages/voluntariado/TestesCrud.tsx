import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFilialId } from "@/hooks/useFilialId";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, FileText, Loader2 } from "lucide-react";

interface Teste {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: "pratico" | "escrito" | "entrevista" | "hibrido";
  pontuacao_minima_aprovacao: number;
  ativo: boolean;
  time_id: string;
  time: {
    nome: string;
  };
}

interface Time {
  id: string;
  nome: string;
}

export default function TestesCrud() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeste, setEditingTeste] = useState<Teste | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    time_id: "",
    titulo: "",
    descricao: "",
    tipo: "pratico" as "pratico" | "escrito" | "entrevista" | "hibrido",
    pontuacao_minima_aprovacao: 70,
    ativo: true,
  });

  // Query para buscar ministérios (times)
  const { data: times } = useQuery({
    queryKey: ["times-ministerios", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return [];

      let query = supabase
        .from("times")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as Time[]) || [];
    },
    enabled: !!igrejaId,
  });

  // Query para buscar testes
  const { data: testes, isLoading } = useQuery({
    queryKey: ["testes-ministerio", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return [];

      // @ts-expect-error - tabela nova, tipos ainda não gerados
      let query = supabase
        .from("testes_ministerio")
        .select(
          `
          id,
          titulo,
          descricao,
          tipo,
          pontuacao_minima_aprovacao,
          ativo,
          time_id,
          time:times!testes_ministerio_time_id_fkey (nome)
        `
        )
        .eq("igreja_id", igrejaId)
        .order("titulo");

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as unknown as Teste[]) || [];
    },
    enabled: !!igrejaId,
  });

  // Mutation para criar/editar teste
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        ...data,
        igreja_id: igrejaId,
        filial_id: filialId,
        created_by: profile?.id,
      };

      if (data.id) {
        // Update
        // @ts-expect-error - tabela nova, tipos ainda não gerados
        const { error } = await supabase
          .from("testes_ministerio")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Insert
        // @ts-expect-error - tabela nova, tipos ainda não gerados
        const { error } = await supabase.from("testes_ministerio").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testes-ministerio"] });
      toast({ title: "Teste salvo com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar teste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar teste
  const deleteMutation = useMutation({
    mutationFn: async (testeId: string) => {
      // @ts-expect-error - tabela nova, tipos ainda não gerados
      const { error } = await supabase
        .from("testes_ministerio")
        .delete()
        .eq("id", testeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testes-ministerio"] });
      toast({ title: "Teste removido com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover teste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenNew = () => {
    setEditingTeste(null);
    setFormData({
      time_id: "",
      titulo: "",
      descricao: "",
      tipo: "pratico",
      pontuacao_minima_aprovacao: 70,
      ativo: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (teste: Teste) => {
    setEditingTeste(teste);
    setFormData({
      time_id: teste.time_id,
      titulo: teste.titulo,
      descricao: teste.descricao || "",
      tipo: teste.tipo,
      pontuacao_minima_aprovacao: teste.pontuacao_minima_aprovacao,
      ativo: teste.ativo,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTeste(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.time_id) {
      toast({
        title: "Ministério obrigatório",
        description: "Selecione um ministério para o teste",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      ...formData,
      ...(editingTeste ? { id: editingTeste.id } : {}),
    });
  };

  const handleDelete = (testeId: string) => {
    if (
      confirm(
        "Tem certeza que deseja remover este teste? Esta ação não pode ser desfeita."
      )
    ) {
      deleteMutation.mutate(testeId);
    }
  };

  const tipoLabels = {
    pratico: "Prático",
    escrito: "Escrito",
    entrevista: "Entrevista",
    hibrido: "Híbrido",
  };

  const tipoColors = {
    pratico: "bg-blue-100 text-blue-800",
    escrito: "bg-green-100 text-green-800",
    entrevista: "bg-purple-100 text-purple-800",
    hibrido: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes de Aptidão</h1>
          <p className="text-muted-foreground">
            Gerencie os testes para avaliação de candidatos por ministério
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Teste
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTeste ? "Editar Teste" : "Novo Teste"}
              </DialogTitle>
              <DialogDescription>
                Configure um teste de aptidão para candidatos de um ministério
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ministério */}
              <div className="space-y-2">
                <Label htmlFor="time_id">Ministério *</Label>
                <Select
                  value={formData.time_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, time_id: value })
                  }
                  disabled={!!editingTeste}
                >
                  <SelectTrigger id="time_id">
                    <SelectValue placeholder="Selecione o ministério" />
                  </SelectTrigger>
                  <SelectContent>
                    {times?.map((time) => (
                      <SelectItem key={time.id} value={time.id}>
                        {time.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  placeholder="Ex: Audição Louvor"
                  required
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descreva o teste e seus objetivos"
                  rows={3}
                />
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Teste *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: "pratico" | "escrito" | "entrevista" | "hibrido") =>
                    setFormData({ ...formData, tipo: value })
                  }
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pratico">Prático</SelectItem>
                    <SelectItem value="escrito">Escrito</SelectItem>
                    <SelectItem value="entrevista">Entrevista</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pontuação Mínima */}
              <div className="space-y-2">
                <Label htmlFor="pontuacao">Pontuação Mínima (%) *</Label>
                <Input
                  id="pontuacao"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.pontuacao_minima_aprovacao}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pontuacao_minima_aprovacao: parseFloat(e.target.value),
                    })
                  }
                  required
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ativo">Teste Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Apenas testes ativos podem ser aplicados
                  </p>
                </div>
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, ativo: checked })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Testes Cadastrados
          </CardTitle>
          <CardDescription>
            {testes?.length || 0} teste(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : testes && testes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ministério</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pontuação Mín.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testes.map((teste) => (
                  <TableRow key={teste.id}>
                    <TableCell className="font-medium">
                      {Array.isArray(teste.time)
                        ? teste.time[0]?.nome
                        : teste.time?.nome}
                    </TableCell>
                    <TableCell>{teste.titulo}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={tipoColors[teste.tipo]}
                      >
                        {tipoLabels[teste.tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell>{teste.pontuacao_minima_aprovacao}%</TableCell>
                    <TableCell>
                      {teste.ativo ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(teste)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(teste.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum teste cadastrado ainda. Clique em "Novo Teste" para
              começar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
