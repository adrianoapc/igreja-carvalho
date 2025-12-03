import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  Trash2, 
  GripVertical, 
  Image as ImageIcon, 
  Video, 
  FileText,
  Film,
  Replace
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  permite_multiplo?: boolean;
}

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  url: string;
  descricao?: string;
}

interface RecursoLiturgia {
  id: string;
  liturgia_item_id: string;
  midia_id: string;
  ordem: number;
  duracao_segundos: number;
  midia?: Midia;
}

interface RecursosLiturgiaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemLiturgia | null;
  onResourcesUpdate: () => void;
}

// Tipos que permitem múltiplas mídias (fallback se permite_multiplo não estiver definido)
const TIPOS_MULTIPLOS = ["Anúncios", "Avisos", "Outro", "anúncios", "avisos", "comunicados"];

// Componente sortable para recurso selecionado
function SortableRecursoCard({ 
  recurso, 
  onRemove 
}: { 
  recurso: RecursoLiturgia; 
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recurso.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const midia = recurso.midia;
  if (!midia) return null;

  const isImage = midia.tipo?.toLowerCase() === 'imagem' || midia.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = midia.tipo?.toLowerCase() === 'vídeo' || midia.url?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className="border-primary/30 bg-primary/5"
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <Badge variant="outline" className="text-xs shrink-0">
            #{recurso.ordem}
          </Badge>
          
          <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
            {isImage ? (
              <img 
                src={midia.url} 
                alt={midia.titulo}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{midia.titulo}</p>
            <p className="text-xs text-muted-foreground">{recurso.duracao_segundos}s</p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onRemove(recurso.id)}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Card de mídia no acervo
function MidiaAcervoCard({ 
  midia, 
  onAdd,
  disabled
}: { 
  midia: Midia; 
  onAdd: (midia: Midia) => void;
  disabled?: boolean;
}) {
  const isImage = midia.tipo?.toLowerCase() === 'imagem' || midia.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = midia.tipo?.toLowerCase() === 'vídeo' || midia.url?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${disabled ? 'opacity-50' : ''}`}
      onClick={() => !disabled && onAdd(midia)}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
            {isImage ? (
              <img 
                src={midia.url} 
                alt={midia.titulo}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{midia.titulo}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {midia.tipo}
            </Badge>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecursosLiturgiaSheet({ 
  open, 
  onOpenChange, 
  item,
  onResourcesUpdate 
}: RecursosLiturgiaSheetProps) {
  const [midias, setMidias] = useState<Midia[]>([]);
  const [recursos, setRecursos] = useState<RecursoLiturgia[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Usa campo permite_multiplo do banco, com fallback para tipos conhecidos
  const permiteMultiplo = item 
    ? (item.permite_multiplo ?? TIPOS_MULTIPLOS.includes(item.tipo?.toLowerCase() || ''))
    : false;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open && item) {
      loadMidias();
      loadRecursos();
    }
  }, [open, item]);

  const loadMidias = async () => {
    try {
      const { data, error } = await supabase
        .from("midias")
        .select("id, titulo, tipo, url, descricao")
        .eq("ativo", true)
        .order("titulo", { ascending: true });

      if (error) throw error;
      setMidias(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar mídias", { description: error.message });
    }
  };

  const loadRecursos = async () => {
    if (!item) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("liturgia_recursos")
        .select(`
          id,
          liturgia_item_id,
          midia_id,
          ordem,
          duracao_segundos,
          midia:midias(id, titulo, tipo, url, descricao)
        `)
        .eq("liturgia_item_id", item.id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      
      // Flatten the midia object
      const recursosFormatados = (data || []).map(r => ({
        ...r,
        midia: Array.isArray(r.midia) ? r.midia[0] : r.midia
      }));
      
      setRecursos(recursosFormatados);
    } catch (error: any) {
      toast.error("Erro ao carregar recursos", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMidia = async (midia: Midia) => {
    if (!item) return;

    setLoading(true);
    try {
      // Se não permite múltiplo e já tem um recurso, substituir
      if (!permiteMultiplo && recursos.length > 0) {
        // Remove o recurso existente
        const { error: deleteError } = await supabase
          .from("liturgia_recursos")
          .delete()
          .eq("liturgia_item_id", item.id);

        if (deleteError) throw deleteError;
      }

      const novaOrdem = permiteMultiplo && recursos.length > 0 
        ? Math.max(...recursos.map(r => r.ordem)) + 1 
        : 1;

      const { error } = await supabase
        .from("liturgia_recursos")
        .insert({
          liturgia_item_id: item.id,
          midia_id: midia.id,
          ordem: novaOrdem,
          duracao_segundos: 10,
        });

      if (error) throw error;
      
      toast.success(permiteMultiplo ? "Mídia adicionada!" : "Mídia substituída!");
      await loadRecursos();
      onResourcesUpdate();
    } catch (error: any) {
      toast.error("Erro ao adicionar mídia", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMidia = async (recursoId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("liturgia_recursos")
        .delete()
        .eq("id", recursoId);

      if (error) throw error;
      
      toast.success("Mídia removida!");
      await loadRecursos();
      onResourcesUpdate();
    } catch (error: any) {
      toast.error("Erro ao remover mídia", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = recursos.findIndex(r => r.id === active.id);
    const newIndex = recursos.findIndex(r => r.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // Update local state immediately for smooth UI
    const newRecursos = arrayMove(recursos, oldIndex, newIndex);
    setRecursos(newRecursos);

    // Update ordem in database
    try {
      const updates = newRecursos.map((r, index) => ({
        id: r.id,
        ordem: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("liturgia_recursos")
          .update({ ordem: update.ordem })
          .eq("id", update.id);
        
        if (error) throw error;
      }
      
      onResourcesUpdate();
    } catch (error: any) {
      toast.error("Erro ao reordenar", { description: error.message });
      await loadRecursos(); // Revert on error
    }
  };

  const filteredMidias = midias.filter(m => 
    m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // IDs das mídias já selecionadas
  const midiasSelecionadasIds = new Set(recursos.map(r => r.midia_id));

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Recursos: {item.titulo}
          </SheetTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{item.tipo}</Badge>
            {permiteMultiplo ? (
              <span className="text-xs">• Permite múltiplas mídias</span>
            ) : (
              <span className="text-xs flex items-center gap-1">
                <Replace className="w-3 h-3" />
                Uma mídia (substitui)
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex h-[calc(100vh-120px)]">
          {/* Lado Esquerdo - Acervo */}
          <div className="flex-1 border-r flex flex-col">
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm mb-2">Acervo de Mídias</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar mídia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {filteredMidias.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mídia encontrada
                  </p>
                ) : (
                  filteredMidias.map(midia => (
                    <MidiaAcervoCard
                      key={midia.id}
                      midia={midia}
                      onAdd={handleAddMidia}
                      disabled={loading || (!permiteMultiplo && midiasSelecionadasIds.has(midia.id))}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Lado Direito - Selecionados */}
          <div className="flex-1 flex flex-col bg-muted/30">
            <div className="p-3 border-b bg-background">
              <h3 className="font-medium text-sm flex items-center gap-2">
                Playlist
                <Badge variant="default" className="ml-auto">
                  {recursos.length} {recursos.length === 1 ? 'slide' : 'slides'}
                </Badge>
              </h3>
              {permiteMultiplo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Arraste para reordenar
                </p>
              )}
            </div>
            
            <ScrollArea className="flex-1 p-3">
              {recursos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma mídia vinculada
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em uma mídia do acervo para adicionar
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={recursos.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {recursos.map(recurso => (
                        <SortableRecursoCard
                          key={recurso.id}
                          recurso={recurso}
                          onRemove={handleRemoveMidia}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
