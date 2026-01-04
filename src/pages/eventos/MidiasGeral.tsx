import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Image, Video, FileText, Pencil, Trash2, GripVertical, Eye, EyeOff, Calendar, Clock, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MidiaDialog } from "@/components/eventos/MidiaDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface Tag {
  id: string;
  nome: string;
  cor: string;
}

interface Midia {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  url: string;
  canal: string;
  ordem: number;
  ativo: boolean;
  evento_id?: string;
  created_at: string;
  scheduled_at?: string | null;
  expires_at?: string | null;
  tags?: Tag[];
  liturgias_count?: number;
}

function SortableMidiaCard({ midia, onEdit, onDelete, onToggleAtivo }: {
  midia: Midia;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: midia.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getIcon = () => {
    switch (midia.tipo) {
      case 'imagem':
        return <Image className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'documento':
        return <FileText className="w-5 h-5" />;
      default:
        return <Image className="w-5 h-5" />;
    }
  };

  const getStatusInfo = () => {
    const now = new Date();
    const isScheduled = midia.scheduled_at && new Date(midia.scheduled_at) > now;
    const isExpired = midia.expires_at && new Date(midia.expires_at) < now;
    const isEffectivelyActive = midia.ativo && !isScheduled && !isExpired;

    return { isScheduled, isExpired, isEffectivelyActive };
  };

  const { isScheduled, isExpired, isEffectivelyActive } = getStatusInfo();

  return (
    <Card ref={setNodeRef} style={style} className={!isEffectivelyActive ? "opacity-50" : ""}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing flex items-center"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Preview */}
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {midia.tipo === 'imagem' && (
              <img src={midia.url} alt={midia.titulo} className="w-full h-full object-cover" />
            )}
            {midia.tipo === 'video' && (
              <video src={midia.url} className="w-full h-full object-cover" />
            )}
            {midia.tipo === 'documento' && (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm truncate">{midia.titulo}</h3>
                  {isScheduled && (
                    <Badge variant="secondary" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      Agendada
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Expirada
                    </Badge>
                  )}
                  {isEffectivelyActive && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      Ativa
                    </Badge>
                  )}
                  {!midia.ativo && (
                    <Badge variant="outline" className="text-xs">
                      Inativa
                    </Badge>
                  )}
                </div>
                {midia.descricao && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {midia.descricao}
                  </p>
                )}
                
                {/* Contador de uso em liturgias */}
                {typeof midia.liturgias_count !== 'undefined' && (
                  <div className="flex items-center gap-1 mt-2">
                    <Badge 
                      variant={midia.liturgias_count > 0 ? "secondary" : "outline"} 
                      className="text-xs"
                    >
                      <ListChecks className="w-3 h-3 mr-1" />
                      {midia.liturgias_count === 0 
                        ? "Nunca usada" 
                        : `Usada em ${midia.liturgias_count} liturgia${midia.liturgias_count !== 1 ? 's' : ''}`
                      }
                    </Badge>
                  </div>
                )}
                
                {/* Tags */}
                {midia.tags && midia.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {midia.tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: tag.cor, color: tag.cor }}
                      >
                        {tag.nome}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Datas */}
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                  {midia.scheduled_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Publica: {format(new Date(midia.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {midia.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expira: {format(new Date(midia.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="flex-shrink-0">
                {getIcon()}
                <span className="ml-1 text-xs capitalize">{midia.tipo}</span>
              </Badge>
            </div>

            {/* Ações */}
            <div className="flex gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleAtivo}
                title={midia.ativo ? "Desativar" : "Ativar"}
              >
                {midia.ativo ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MidiasGeral() {
  const [midias, setMidias] = useState<Midia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [midiaEditando, setMidiaEditando] = useState<Midia | undefined>();
  const [canalAtivo, setCanalAtivo] = useState("telao");
  const [midiaParaDeletar, setMidiaParaDeletar] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Detectar canal inicial da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canalParam = params.get("canal");
    if (canalParam && ["app", "redes_sociais", "telao", "site"].includes(canalParam)) {
      setCanalAtivo(canalParam);
    }
    
    // Abrir dialog de nova mídia se tiver parâmetro novo=true
    const novoParam = params.get("novo");
    if (novoParam === "true") {
      setDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!igrejaLoading && igrejaId) {
      loadMidias();
      loadTags();
    }
  }, [canalAtivo, igrejaId, igrejaLoading]);
  
  const loadTags = async () => {
    try {
      if (!igrejaId) return;
      const { data, error } = await supabase
        .from('tags_midias')
        .select('*')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId)
        .order('nome', { ascending: true });
      
      if (error) throw error;
      setTags(data || []);
    } catch (error: unknown) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const loadMidias = async () => {
    setLoading(true);
    try {
      if (!igrejaId) {
        setMidias([]);
        return;
      }
      const { data: midiasData, error } = await supabase
        .from('midias')
        .select('*')
        .eq('canal', canalAtivo)
        .eq('igreja_id', igrejaId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      
      // Carregar todas as liturgias para contar uso das mídias
      const { data: liturgiasData } = await supabase
        .from('liturgias')
        .select('midias_ids')
        .eq('igreja_id', igrejaId);
      
      // Carregar tags de cada mídia e contar uso em liturgias
      const midiasComDados = await Promise.all(
        (midiasData || []).map(async (midia) => {
          // Carregar tags
          const { data: tagsData } = await supabase
            .from('midia_tags')
            .select('tag_id, tags_midias(id, nome, cor)')
            .eq('midia_id', midia.id)
            .eq('igreja_id', igrejaId);
          
          const tagsParsed = tagsData?.map((t: Record<string, unknown>) => t.tags_midias as { id: string; nome: string; cor: string } | null).filter((t): t is { id: string; nome: string; cor: string } => t !== null) || [];
          
          // Contar em quantas liturgias a mídia aparece
          const liturgias_count = (liturgiasData || []).filter(
            liturgia => liturgia.midias_ids && liturgia.midias_ids.includes(midia.id)
          ).length;
          
          return { ...midia, tags: tagsParsed, liturgias_count };
        })
      );
      
      setMidias(midiasComDados as Midia[]);
    } catch (error: unknown) {
      console.error('Erro ao carregar mídias:', error);
      toast.error("Erro ao carregar mídias");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = midias.findIndex((m) => m.id === active.id);
      const newIndex = midias.findIndex((m) => m.id === over.id);

      const newMidias = arrayMove(midias, oldIndex, newIndex);
      setMidias(newMidias);

      // Atualizar ordem no banco
      try {
        if (!igrejaId) return;
        const updates = newMidias.map((midia, index) => ({
          id: midia.id,
          ordem: index + 1
        }));

        for (const update of updates) {
          await supabase
            .from('midias')
            .update({ ordem: update.ordem })
            .eq('id', update.id)
            .eq('igreja_id', igrejaId);
        }

        toast.success("Ordem atualizada!");
      } catch (error) {
        console.error('Erro ao atualizar ordem:', error);
        toast.error("Erro ao atualizar ordem");
        loadMidias(); // Recarregar em caso de erro
      }
    }
  };

  const handleNovaMidia = () => {
    setMidiaEditando(undefined);
    setDialogOpen(true);
  };

  const handleEditarMidia = (midia: Midia) => {
    setMidiaEditando(midia);
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setMidiaEditando(undefined);
    }
  };

  const handleDeletar = async (id: string) => {
    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      // Buscar URL da mídia para deletar do storage
      const midia = midias.find(m => m.id === id);
      if (midia?.url) {
        const path = midia.url.split('/midias/')[1];
        // Security: validate path to prevent traversal attacks
        if (path && !path.includes('..') && !path.startsWith('/')) {
          await supabase.storage.from('midias').remove([path]);
        }
      }

      const { error } = await supabase
        .from('midias')
        .delete()
        .eq('id', id)
        .eq('igreja_id', igrejaId);

      if (error) throw error;

      toast.success("Mídia deletada com sucesso!");
      loadMidias();
    } catch (error: unknown) {
      console.error('Erro ao deletar mídia:', error);
      toast.error("Erro ao deletar mídia");
    } finally {
      setMidiaParaDeletar(null);
    }
  };

  const handleToggleAtivo = async (midia: Midia) => {
    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      const { error } = await supabase
        .from('midias')
        .update({ ativo: !midia.ativo })
        .eq('id', midia.id)
        .eq('igreja_id', igrejaId);

      if (error) throw error;

      toast.success(midia.ativo ? "Mídia desativada" : "Mídia ativada");
      loadMidias();
    } catch (error: unknown) {
      console.error('Erro ao atualizar mídia:', error);
      toast.error("Erro ao atualizar mídia");
    }
  };

  const getCanalLabel = (canal: string) => {
    const labels: Record<string, string> = {
      app: "App",
      redes_sociais: "Redes Sociais",
      telao: "Telão do Evento",
      site: "Site"
    };
    return labels[canal] || canal;
  };
  
  // Filtrar mídias por tag
  const midiasFiltradas = tagFiltro
    ? midias.filter(midia => midia.tags?.some(tag => tag.id === tagFiltro))
    : midias;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mídias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie conteúdo visual para diferentes canais
          </p>
        </div>
        <Button onClick={handleNovaMidia}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Mídia
        </Button>
      </div>

      <Tabs value={canalAtivo} onValueChange={setCanalAtivo}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="telao">Telão</TabsTrigger>
          <TabsTrigger value="app">App</TabsTrigger>
          <TabsTrigger value="redes_sociais">Redes Sociais</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
        </TabsList>

        <TabsContent value={canalAtivo} className="mt-6 space-y-4">
          {/* Filtro por Tags */}
          {tags.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Filtrar por tag:</Label>
                  <Badge
                    variant={!tagFiltro ? "default" : "outline"}
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setTagFiltro(null)}
                  >
                    Todas ({midias.length})
                  </Badge>
                  {tags.map(tag => {
                    const count = midias.filter(m => m.tags?.some(t => t.id === tag.id)).length;
                    return (
                      <Badge
                        key={tag.id}
                        variant={tagFiltro === tag.id ? "default" : "outline"}
                        className="cursor-pointer hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: tagFiltro === tag.id ? tag.cor : 'transparent',
                          borderColor: tag.cor,
                          color: tagFiltro === tag.id ? 'white' : tag.cor
                        }}
                        onClick={() => setTagFiltro(tag.id)}
                      >
                        {tag.nome} ({count})
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando mídias...
            </div>
          ) : midiasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">
                  {tagFiltro ? "Nenhuma mídia com esta tag" : "Nenhuma mídia encontrada"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {tagFiltro 
                    ? "Tente selecionar outra tag ou limpar o filtro" 
                    : `Adicione mídias para ${getCanalLabel(canalAtivo)}`
                  }
                </p>
                {!tagFiltro && (
                  <Button onClick={handleNovaMidia}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Primeira Mídia
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={midiasFiltradas.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {midiasFiltradas.map((midia) => (
                    <SortableMidiaCard
                      key={midia.id}
                      midia={midia}
                      onEdit={() => handleEditarMidia(midia)}
                      onDelete={() => setMidiaParaDeletar(midia.id)}
                      onToggleAtivo={() => handleToggleAtivo(midia)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MidiaDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        midia={midiaEditando}
        onSuccess={loadMidias}
      />

      <AlertDialog open={!!midiaParaDeletar} onOpenChange={() => setMidiaParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta mídia? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => midiaParaDeletar && handleDeletar(midiaParaDeletar)}
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
