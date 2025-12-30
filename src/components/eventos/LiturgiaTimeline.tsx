import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Clock, User, Film, Plus, Layers, Save, Video, BookOpen, Timer, Image, Users, HelpCircle, Presentation } from "lucide-react";
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

export type TipoConteudo = 'ATO_PRESENCIAL' | 'VIDEO' | 'IMAGEM' | 'VERSICULO' | 'PEDIDOS' | 'TIMER' | 'QUIZ' | 'AUDIO' | 'TEXTO';

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  duracao_minutos: number | null;
  responsavel_id: string | null;
  responsavel_externo: string | null;
  permite_multiplo?: boolean;
  tipo_conteudo?: TipoConteudo;
  conteudo_config?: Record<string, unknown>;
  bloqueio_progresso?: boolean;
  responsavel?: {
    nome: string;
  };
}

const TIPO_CONTEUDO_ICONS: Record<TipoConteudo, { icon: typeof Video; label: string; color: string }> = {
  'ATO_PRESENCIAL': { icon: Presentation, label: 'Presencial', color: 'text-muted-foreground' },
  'VIDEO': { icon: Video, label: 'Vídeo', color: 'text-red-500' },
  'IMAGEM': { icon: Image, label: 'Imagem', color: 'text-blue-500' },
  'VERSICULO': { icon: BookOpen, label: 'Versículo', color: 'text-amber-500' },
  'PEDIDOS': { icon: Users, label: 'Pedidos', color: 'text-purple-500' },
  'TIMER': { icon: Timer, label: 'Timer', color: 'text-green-500' },
  'QUIZ': { icon: HelpCircle, label: 'Quiz', color: 'text-pink-500' },
  'AUDIO': { icon: Film, label: 'Áudio', color: 'text-cyan-500' },
  'TEXTO': { icon: BookOpen, label: 'Texto', color: 'text-orange-500' },
};

interface LiturgiaTimelineProps {
  itens: ItemLiturgia[];
  selectedItemId: string | null;
  recursosCount: Map<string, number>;
  onSelectItem: (item: ItemLiturgia) => void;
  onReorder: (itens: ItemLiturgia[]) => void;
  onAddItem: () => void;
  onApplyTemplate: () => void;
  onSaveTemplate: () => void;
}

function SortableItemCard({ 
  item, 
  isSelected, 
  recursosCount,
  onClick 
}: { 
  item: ItemLiturgia; 
  isSelected: boolean;
  recursosCount: number;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const responsavelNome = item.responsavel?.nome || item.responsavel_externo;

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected 
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
          : 'hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
            {item.ordem}
          </Badge>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.titulo}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {item.tipo}
              </Badge>
              {/* Ícone do tipo de conteúdo */}
              {item.tipo_conteudo && item.tipo_conteudo !== 'ATO_PRESENCIAL' && (
                (() => {
                  const config = TIPO_CONTEUDO_ICONS[item.tipo_conteudo];
                  const IconComponent = config?.icon || Presentation;
                  return (
                    <span className={`text-xs flex items-center gap-1 ${config?.color || ''}`} title={config?.label}>
                      <IconComponent className="w-3 h-3" />
                    </span>
                  );
                })()
              )}
              {item.duracao_minutos && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.duracao_minutos}min
                </span>
              )}
              {recursosCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  {recursosCount}
                </span>
              )}
            </div>
            {responsavelNome && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                <User className="w-3 h-3 shrink-0" />
                {responsavelNome}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiturgiaTimeline({
  itens,
  selectedItemId,
  recursosCount,
  onSelectItem,
  onReorder,
  onAddItem,
  onApplyTemplate,
  onSaveTemplate,
}: LiturgiaTimelineProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = itens.findIndex(i => i.id === active.id);
    const newIndex = itens.findIndex(i => i.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    const newItens = arrayMove(itens, oldIndex, newIndex).map((item, index) => ({
      ...item,
      ordem: index + 1
    }));
    
    onReorder(newItens);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm">Timeline</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onApplyTemplate} title="Aplicar Template">
            <Layers className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSaveTemplate} 
            title="Salvar como Template"
            disabled={itens.length === 0}
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lista Sortable */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itens.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pb-4">
              {itens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhum item na liturgia</p>
                  <p className="text-xs mt-1">Adicione itens ou aplique um template</p>
                </div>
              ) : (
                itens.map((item) => (
                  <SortableItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    recursosCount={recursosCount.get(item.id) || 0}
                    onClick={() => onSelectItem(item)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>

      {/* Footer - Adicionar Item */}
      <div className="pt-3 border-t">
        <Button className="w-full" onClick={onAddItem}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Item
        </Button>
      </div>
    </div>
  );
}
