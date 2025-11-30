import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Image, Video, FileText, Pencil, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MidiaDialog } from "@/components/cultos/MidiaDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Midia {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  url: string;
  canal: string;
  ordem: number;
  ativo: boolean;
  culto_id?: string;
  created_at: string;
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

  return (
    <Card ref={setNodeRef} style={style} className={!midia.ativo ? "opacity-50" : ""}>
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
                <h3 className="font-semibold text-sm truncate">{midia.titulo}</h3>
                {midia.descricao && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {midia.descricao}
                  </p>
                )}
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
    loadMidias();
  }, [canalAtivo]);

  const loadMidias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('midias')
        .select('*')
        .eq('canal', canalAtivo)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setMidias(data || []);
    } catch (error: any) {
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
        const updates = newMidias.map((midia, index) => ({
          id: midia.id,
          ordem: index + 1
        }));

        for (const update of updates) {
          await supabase
            .from('midias')
            .update({ ordem: update.ordem })
            .eq('id', update.id);
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

  const handleDeletar = async (id: string) => {
    try {
      // Buscar URL da mídia para deletar do storage
      const midia = midias.find(m => m.id === id);
      if (midia?.url) {
        const path = midia.url.split('/midias/')[1];
        if (path) {
          await supabase.storage.from('midias').remove([path]);
        }
      }

      const { error } = await supabase
        .from('midias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Mídia deletada com sucesso!");
      loadMidias();
    } catch (error: any) {
      console.error('Erro ao deletar mídia:', error);
      toast.error("Erro ao deletar mídia");
    } finally {
      setMidiaParaDeletar(null);
    }
  };

  const handleToggleAtivo = async (midia: Midia) => {
    try {
      const { error } = await supabase
        .from('midias')
        .update({ ativo: !midia.ativo })
        .eq('id', midia.id);

      if (error) throw error;

      toast.success(midia.ativo ? "Mídia desativada" : "Mídia ativada");
      loadMidias();
    } catch (error: any) {
      console.error('Erro ao atualizar mídia:', error);
      toast.error("Erro ao atualizar mídia");
    }
  };

  const getCanalLabel = (canal: string) => {
    const labels: Record<string, string> = {
      app: "App",
      redes_sociais: "Redes Sociais",
      telao: "Telão do Culto",
      site: "Site"
    };
    return labels[canal] || canal;
  };

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

        <TabsContent value={canalAtivo} className="mt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando mídias...
            </div>
          ) : midias.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Nenhuma mídia encontrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adicione mídias para {getCanalLabel(canalAtivo)}
                </p>
                <Button onClick={handleNovaMidia}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeira Mídia
                </Button>
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
                  items={midias.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {midias.map((midia) => (
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
        onOpenChange={setDialogOpen}
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