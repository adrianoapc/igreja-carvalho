import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Video, FileText } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  canal: string;
  url: string;
}

interface MidiaSelecionadaItemProps {
  midia: Midia;
  index: number;
  onRemove: (id: string) => void;
}

interface SeletorMidiasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  midias: Midia[];
  midiasSelecionadas: string[];
  onMidiasChange: (midiasIds: string[]) => void;
  MidiaSelecionadaItem: React.ComponentType<MidiaSelecionadaItemProps>;
}

export function SeletorMidiasDialog({
  open,
  onOpenChange,
  midias,
  midiasSelecionadas,
  onMidiasChange,
  MidiaSelecionadaItem,
}: SeletorMidiasDialogProps) {
  const sensorsMidias = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const toggleMidiaSelecao = (midiaId: string) => {
    if (midiasSelecionadas.includes(midiaId)) {
      onMidiasChange(midiasSelecionadas.filter(id => id !== midiaId));
    } else {
      onMidiasChange([...midiasSelecionadas, midiaId]);
    }
  };

  const removerMidiaSelecionada = (midiaId: string) => {
    onMidiasChange(midiasSelecionadas.filter(id => id !== midiaId));
  };

  const handleDragEndMidias = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = midiasSelecionadas.indexOf(active.id as string);
    const newIndex = midiasSelecionadas.indexOf(over.id as string);
    onMidiasChange(arrayMove(midiasSelecionadas, oldIndex, newIndex));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Mídias</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Lista de mídias disponíveis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mídias Disponíveis</Label>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {midias.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mídia disponível
                  </p>
                ) : (
                  midias.map(midia => {
                    const isSelected = midiasSelecionadas.includes(midia.id);
                    const isImage = midia.tipo === 'Imagem' || midia.tipo === 'imagem' || midia.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    const isVideo = midia.tipo === 'Vídeo' || midia.tipo === 'video' || midia.url.match(/\.(mp4|webm|ogg)$/i);
                    
                    return (
                      <Card
                        key={midia.id}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-accent ring-2 ring-primary/20'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => toggleMidiaSelecao(midia.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Thumbnail */}
                            <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              {isImage ? (
                                <img 
                                  src={midia.url} 
                                  alt={midia.titulo}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      parent.classList.add('flex', 'items-center', 'justify-center');
                                      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                                      svg.setAttribute('class', 'w-8 h-8 text-muted-foreground');
                                      svg.setAttribute('width', '24');
                                      svg.setAttribute('height', '24');
                                      svg.setAttribute('viewBox', '0 0 24 24');
                                      svg.setAttribute('fill', 'none');
                                      svg.setAttribute('stroke', 'currentColor');
                                      svg.setAttribute('stroke-width', '2');
                                      svg.setAttribute('stroke-linecap', 'round');
                                      svg.setAttribute('stroke-linejoin', 'round');
                                      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                                      rect.setAttribute('width', '18');
                                      rect.setAttribute('height', '18');
                                      rect.setAttribute('x', '3');
                                      rect.setAttribute('y', '3');
                                      rect.setAttribute('rx', '2');
                                      rect.setAttribute('ry', '2');
                                      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                                      circle.setAttribute('cx', '9');
                                      circle.setAttribute('cy', '9');
                                      circle.setAttribute('r', '2');
                                      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                                      path.setAttribute('d', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21');
                                      svg.appendChild(rect);
                                      svg.appendChild(circle);
                                      svg.appendChild(path);
                                      parent.appendChild(svg);
                                    }
                                  }}
                                />
                              ) : isVideo ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Video className="w-8 h-8 text-muted-foreground" />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{midia.titulo}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {midia.tipo}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {midia.canal}
                                </Badge>
                              </div>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {}}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Mídias selecionadas com drag and drop */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Mídias Selecionadas ({midiasSelecionadas.length})
            </Label>
            <ScrollArea className="h-[400px] pr-4">
              {midiasSelecionadas.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mídia selecionada
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensorsMidias}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndMidias}
                >
                  <SortableContext
                    items={midiasSelecionadas}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {midiasSelecionadas.map((midiaId, index) => {
                        const midia = midias.find(m => m.id === midiaId);
                        if (!midia) return null;
                        
                        return <MidiaSelecionadaItem key={midiaId} midia={midia} index={index} onRemove={removerMidiaSelecionada} />;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Confirmar ({midiasSelecionadas.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
