import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Clock, User } from "lucide-react";

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
}

interface Membro {
  id: string;
  nome: string;
}

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  duracao_minutos: number | null;
  responsavel_id: string | null;
  responsavel?: {
    nome: string;
  };
}

interface LiturgiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  culto: Culto | null;
}

const TIPOS_LITURGIA = [
  "Abertura",
  "Louvor",
  "Adoração",
  "Oração",
  "Leitura Bíblica",
  "Pregação",
  "Oferta",
  "Santa Ceia",
  "Anúncios",
  "Encerramento",
  "Outro"
];

export default function LiturgiaDialog({ open, onOpenChange, culto }: LiturgiaDialogProps) {
  const [itens, setItens] = useState<ItemLiturgia[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<ItemLiturgia | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<number | undefined>(undefined);
  const [responsavelId, setResponsavelId] = useState<string>("");

  useEffect(() => {
    if (open && culto) {
      loadItens();
      loadMembros();
    }
  }, [open, culto]);

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("status", "membro")
        .order("nome", { ascending: true });

      if (error) throw error;
      setMembros(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar membros", {
        description: error.message
      });
    }
  };

  const loadItens = async () => {
    if (!culto) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("liturgia_culto")
        .select(`
          *,
          responsavel:profiles!responsavel_id(nome)
        `)
        .eq("culto_id", culto.id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setItens(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar liturgia", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipo("");
    setTitulo("");
    setDescricao("");
    setDuracaoMinutos(undefined);
    setResponsavelId("");
    setEditando(null);
    setShowForm(false);
  };

  const handleNovoItem = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditarItem = (item: ItemLiturgia) => {
    setEditando(item);
    setTipo(item.tipo);
    setTitulo(item.titulo);
    setDescricao(item.descricao || "");
    setDuracaoMinutos(item.duracao_minutos || undefined);
    setResponsavelId(item.responsavel_id || "");
    setShowForm(true);
  };

  const handleSalvar = async () => {
    if (!culto || !tipo || !titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      if (editando) {
        // Atualizar item existente
        const { error } = await supabase
          .from("liturgia_culto")
          .update({
            tipo,
            titulo,
            descricao: descricao || null,
            duracao_minutos: duracaoMinutos || null,
            responsavel_id: responsavelId || null,
          })
          .eq("id", editando.id);

        if (error) throw error;
        toast.success("Item atualizado com sucesso!");
      } else {
        // Criar novo item
        const novaOrdem = itens.length > 0 ? Math.max(...itens.map(i => i.ordem)) + 1 : 1;
        
        const { error } = await supabase
          .from("liturgia_culto")
          .insert([{
            culto_id: culto.id,
            tipo,
            titulo,
            descricao: descricao || null,
            ordem: novaOrdem,
            duracao_minutos: duracaoMinutos || null,
            responsavel_id: responsavelId || null,
          }]);

        if (error) throw error;
        toast.success("Item adicionado com sucesso!");
      }

      await loadItens();
      resetForm();
    } catch (error: any) {
      toast.error("Erro ao salvar item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Deseja remover este item da liturgia?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("liturgia_culto")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Item removido com sucesso!");
      await loadItens();
    } catch (error: any) {
      toast.error("Erro ao remover item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoverOrdem = async (item: ItemLiturgia, direcao: "up" | "down") => {
    const index = itens.findIndex(i => i.id === item.id);
    if ((direcao === "up" && index === 0) || (direcao === "down" && index === itens.length - 1)) {
      return;
    }

    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    const outroItem = itens[novoIndex];

    setLoading(true);
    try {
      // Trocar as ordens
      const { error: error1 } = await supabase
        .from("liturgia_culto")
        .update({ ordem: outroItem.ordem })
        .eq("id", item.id);

      const { error: error2 } = await supabase
        .from("liturgia_culto")
        .update({ ordem: item.ordem })
        .eq("id", outroItem.id);

      if (error1 || error2) throw error1 || error2;
      await loadItens();
    } catch (error: any) {
      toast.error("Erro ao reordenar item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const duracaoTotal = itens.reduce((sum, item) => sum + (item.duracao_minutos || 0), 0);

  if (!culto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Liturgia - {culto.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Duração Total:</span>
              <Badge variant="outline">{duracaoTotal} min</Badge>
            </div>
            <Button size="sm" onClick={handleNovoItem} disabled={loading || showForm}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          {/* Formulário de adicionar/editar */}
          {showForm && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_LITURGIA.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duração (min)</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={duracaoMinutos || ""}
                      onChange={(e) => setDuracaoMinutos(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ex: Momento de Adoração"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Responsável</Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {membros.map((membro) => (
                        <SelectItem key={membro.id} value={membro.id}>
                          {membro.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Detalhes adicionais..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSalvar} disabled={loading}>
                    {loading ? "Salvando..." : editando ? "Atualizar" : "Adicionar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de itens */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {itens.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum item adicionado. Comece criando a liturgia do culto.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                itens.map((item, index) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {item.tipo}
                            </Badge>
                            {item.duracao_minutos && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {item.duracao_minutos} min
                              </Badge>
                            )}
                            {item.responsavel && (
                              <Badge variant="secondary" className="text-xs">
                                <User className="w-3 h-3 mr-1" />
                                {item.responsavel.nome}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-sm">{item.titulo}</h4>
                          {item.descricao && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.descricao}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(item, "up")}
                            disabled={loading || index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(item, "down")}
                            disabled={loading || index === itens.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarItem(item)}
                            disabled={loading || showForm}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemover(item.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
