import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Eye, EyeOff, Megaphone, ImageIcon, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComunicadoDialog } from "@/components/comunicados/ComunicadoDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Database } from "@/integrations/supabase/types";

type TipoComunicado = Database["public"]["Enums"]["tipo_comunicado"];

interface Comunicado {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  tipo: TipoComunicado;
  nivel_urgencia: string | null;
  link_acao: string | null;
  ativo: boolean | null;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string | null;
}

export default function Comunicados() {
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComunicado, setEditingComunicado] = useState<Comunicado | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadComunicados();
  }, []);

  const loadComunicados = async () => {
    try {
      const { data, error } = await supabase
        .from("comunicados")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComunicados(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar comunicados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (comunicado: Comunicado) => {
    setEditingComunicado(comunicado);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingComunicado(null);
    setDialogOpen(true);
  };

  const toggleActive = async (id: string, currentActive: boolean | null) => {
    try {
      const { error } = await supabase
        .from("comunicados")
        .update({ ativo: !currentActive })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Status atualizado!" });
      loadComunicados();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const comunicado = comunicados.find((c) => c.id === deletingId);
      
      // Deletar imagem do storage se existir
      if (comunicado?.imagem_url) {
        const path = comunicado.imagem_url.split("/").pop();
        if (path) {
          await supabase.storage.from("comunicados").remove([path]);
        }
      }

      const { error } = await supabase.from("comunicados").delete().eq("id", deletingId);

      if (error) throw error;

      toast({ title: "Comunicado removido!" });
      loadComunicados();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const getStatusInfo = (comunicado: Comunicado) => {
    const now = new Date();
    const dataInicio = comunicado.data_inicio ? new Date(comunicado.data_inicio) : null;
    const dataFim = comunicado.data_fim ? new Date(comunicado.data_fim) : null;

    if (!comunicado.ativo) {
      return { label: "Inativo", variant: "secondary" as const };
    }
    if (dataInicio && dataInicio > now) {
      return { label: "Agendado", variant: "outline" as const };
    }
    if (dataFim && dataFim < now) {
      return { label: "Expirado", variant: "secondary" as const };
    }
    return { label: "Ativo", variant: "default" as const };
  };

  const formatValidity = (comunicado: Comunicado) => {
    const dataInicio = comunicado.data_inicio 
      ? format(new Date(comunicado.data_inicio), "dd/MM/yy", { locale: ptBR })
      : "Imediato";
    const dataFim = comunicado.data_fim 
      ? format(new Date(comunicado.data_fim), "dd/MM/yy", { locale: ptBR })
      : "Sem fim";
    return `${dataInicio} → ${dataFim}`;
  };

  if (!hasAccess("banners", "criar_editar")) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Você não tem permissão para gerenciar comunicados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comunicados</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie banners e alertas para os membros
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Comunicado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Comunicados</CardTitle>
          <CardDescription>
            {comunicados.length} comunicado{comunicados.length !== 1 ? "s" : ""} cadastrado{comunicados.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : comunicados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Megaphone className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">Nenhum comunicado criado ainda</p>
              <Button onClick={handleNew} variant="outline" className="mt-4">
                Criar primeiro comunicado
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comunicados.map((comunicado) => {
                    const status = getStatusInfo(comunicado);
                    return (
                      <TableRow key={comunicado.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {comunicado.titulo}
                        </TableCell>
                        <TableCell>
                          {comunicado.tipo === "banner" ? (
                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Banner
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              <Megaphone className="w-3 h-3 mr-1" />
                              Alerta
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatValidity(comunicado)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActive(comunicado.id, comunicado.ativo)}
                              title={comunicado.ativo ? "Desativar" : "Ativar"}
                            >
                              {comunicado.ativo ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(comunicado)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(comunicado.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ComunicadoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        comunicado={editingComunicado}
        onSuccess={loadComunicados}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este comunicado? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
