import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Edit, Trash2, Eye, EyeOff, Megaphone, ImageIcon, Calendar, 
  Smartphone, Monitor, Globe, Download, LayoutGrid
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PublicacaoStepper } from "@/components/publicacao/PublicacaoStepper";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Publicacao {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  tipo: string;
  nivel_urgencia: string | null;
  link_acao: string | null;
  ativo: boolean | null;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string | null;
  exibir_app: boolean | null;
  exibir_telao: boolean | null;
  exibir_site: boolean | null;
  tags: string[] | null;
  culto_id: string | null;
  ordem_telao: number | null;
  categoria_midia: string | null;
}

const TAGS_MOMENTO = [
  { value: "abertura", label: "Abertura", cor: "#3B82F6" },
  { value: "adoracao", label: "Adoração", cor: "#8B5CF6" },
  { value: "oferta", label: "Oferta", cor: "#F59E0B" },
  { value: "palavra", label: "Palavra", cor: "#10B981" },
  { value: "ceia", label: "Ceia", cor: "#EC4899" },
  { value: "avisos", label: "Avisos", cor: "#6366F1" },
  { value: "encerramento", label: "Encerramento", cor: "#EF4444" },
];

export default function Publicacao() {
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Publicacao | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [canalAtivo, setCanalAtivo] = useState("todos");
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);

  useEffect(() => {
    loadPublicacoes();
  }, []);

  const loadPublicacoes = async () => {
    try {
      const { data, error } = await supabase
        .from("comunicados")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPublicacoes(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: Publicacao) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingItem(null);
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
      loadPublicacoes();
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
      const item = publicacoes.find((p) => p.id === deletingId);
      
      if (item?.imagem_url) {
        const path = item.imagem_url.split("/").pop();
        if (path) {
          await supabase.storage.from("comunicados").remove([path]);
        }
      }

      const { error } = await supabase.from("comunicados").delete().eq("id", deletingId);
      if (error) throw error;

      toast({ title: "Publicação removida!" });
      loadPublicacoes();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const getStatusInfo = (item: Publicacao) => {
    const now = new Date();
    const dataInicio = item.data_inicio ? new Date(item.data_inicio) : null;
    const dataFim = item.data_fim ? new Date(item.data_fim) : null;

    if (!item.ativo) return { label: "Inativo", variant: "secondary" as const };
    if (dataInicio && dataInicio > now) return { label: "Agendado", variant: "outline" as const };
    if (dataFim && dataFim < now) return { label: "Expirado", variant: "secondary" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  const formatValidity = (item: Publicacao) => {
    const dataInicio = item.data_inicio 
      ? format(new Date(item.data_inicio), "dd/MM/yy", { locale: ptBR })
      : "Imediato";
    const dataFim = item.data_fim 
      ? format(new Date(item.data_fim), "dd/MM/yy", { locale: ptBR })
      : "∞";
    return `${dataInicio} → ${dataFim}`;
  };

  // Filtrar por canal
  const publicacoesFiltradas = publicacoes.filter(p => {
    if (canalAtivo === "todos") return true;
    if (canalAtivo === "app") return p.exibir_app;
    if (canalAtivo === "telao") return p.exibir_telao;
    if (canalAtivo === "site") return p.exibir_site;
    return true;
  }).filter(p => {
    if (!tagFiltro || canalAtivo !== "telao") return true;
    return p.tags?.includes(tagFiltro);
  });

  const handleDownloadPlaylist = () => {
    const playlist = publicacoesFiltradas
      .filter(p => p.exibir_telao && p.ativo)
      .sort((a, b) => (a.ordem_telao || 0) - (b.ordem_telao || 0))
      .map((p, i) => `${i + 1}. ${p.titulo} - ${p.imagem_url || 'Sem mídia'}`)
      .join('\n');
    
    const blob = new Blob([playlist], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist-telao.txt';
    a.click();
    toast({ title: "Playlist exportada!" });
  };

  if (!hasAccess("banners", "criar_editar")) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Você não tem permissão para gerenciar publicações.
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
          <h1 className="text-3xl font-bold text-foreground">Hub de Publicação</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie conteúdos para App, Telão e Site
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Publicação
        </Button>
      </div>

      <Tabs value={canalAtivo} onValueChange={v => { setCanalAtivo(v); setTagFiltro(null); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="app" className="gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">App</span>
          </TabsTrigger>
          <TabsTrigger value="telao" className="gap-2">
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Telão</span>
          </TabsTrigger>
          <TabsTrigger value="site" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Site</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={canalAtivo} className="mt-4">
          {/* Filtro de Tags para Telão */}
          {canalAtivo === "telao" && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground">Filtrar:</span>
                    <Badge
                      variant={!tagFiltro ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setTagFiltro(null)}
                    >
                      Todas
                    </Badge>
                    {TAGS_MOMENTO.map(tag => (
                      <Badge
                        key={tag.value}
                        variant={tagFiltro === tag.value ? "default" : "outline"}
                        className="cursor-pointer"
                        style={tagFiltro === tag.value ? { backgroundColor: tag.cor } : { borderColor: tag.cor, color: tag.cor }}
                        onClick={() => setTagFiltro(tag.value)}
                      >
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDownloadPlaylist}>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Playlist
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {canalAtivo === "todos" ? "Todas as Publicações" : 
                 canalAtivo === "app" ? "Publicações do App" :
                 canalAtivo === "telao" ? "Publicações do Telão" : "Publicações do Site"}
              </CardTitle>
              <CardDescription>
                {publicacoesFiltradas.length} publicação{publicacoesFiltradas.length !== 1 ? "ões" : ""} encontrada{publicacoesFiltradas.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : publicacoesFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Megaphone className="w-16 h-16 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">Nenhuma publicação encontrada</p>
                  <Button onClick={handleNew} variant="outline" className="mt-4">
                    Criar primeira publicação
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Canais</TableHead>
                        {canalAtivo === "telao" && <TableHead>Tags</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {publicacoesFiltradas.map((item) => {
                        const status = getStatusInfo(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium max-w-[200px]">
                              <div className="flex items-center gap-2">
                                {item.imagem_url && (
                                  <img src={item.imagem_url} alt="" className="w-10 h-10 rounded object-cover" />
                                )}
                                <span className="truncate">{item.titulo}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.tipo === "banner" ? (
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
                              <div className="flex gap-1">
                                {item.exibir_app && (
                                  <Badge variant="outline" className="text-xs">
                                    <Smartphone className="w-3 h-3" />
                                  </Badge>
                                )}
                                {item.exibir_telao && (
                                  <Badge variant="outline" className="text-xs">
                                    <Monitor className="w-3 h-3" />
                                  </Badge>
                                )}
                                {item.exibir_site && (
                                  <Badge variant="outline" className="text-xs">
                                    <Globe className="w-3 h-3" />
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            {canalAtivo === "telao" && (
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.tags?.map(tagValue => {
                                    const tagInfo = TAGS_MOMENTO.find(t => t.value === tagValue);
                                    return tagInfo ? (
                                      <Badge 
                                        key={tagValue} 
                                        variant="outline" 
                                        className="text-xs"
                                        style={{ borderColor: tagInfo.cor, color: tagInfo.cor }}
                                      >
                                        {tagInfo.label}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatValidity(item)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleActive(item.id, item.ativo)}
                                  title={item.ativo ? "Desativar" : "Ativar"}
                                >
                                  {item.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => confirmDelete(item.id)}
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
        </TabsContent>
      </Tabs>

      <PublicacaoStepper
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        publicacao={editingItem}
        onSuccess={loadPublicacoes}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.
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
