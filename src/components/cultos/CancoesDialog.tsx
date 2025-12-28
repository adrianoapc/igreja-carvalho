import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Music2, User, Guitar, Mic } from "lucide-react";
import { z } from "zod";

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
}

interface Membro {
  id: string;
  nome: string;
}

interface Cancao {
  id: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  bpm: number | null;
  duracao_minutos: number | null;
  ordem: number;
  cifra: string | null;
  letra: string | null;
  link_youtube: string | null;
  link_spotify: string | null;
  observacoes: string | null;
  solista_id: string | null;
  ministro_id: string | null;
  solista?: { nome: string };
  ministro?: { nome: string };
}

interface CancoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  culto: Evento | null;
}

const cancaoSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório").max(200, "Título muito longo"),
  artista: z.string().trim().max(200, "Nome do artista muito longo").optional(),
  tom: z.string().trim().max(10, "Tom muito longo").optional(),
  bpm: z.number().int().min(20).max(300).optional(),
  duracao_minutos: z.number().int().min(1).max(120).optional(),
  link_youtube: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  link_spotify: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  cifra: z.string().trim().max(5000, "Cifra muito longa").optional(),
  letra: z.string().trim().max(10000, "Letra muito longa").optional(),
  observacoes: z.string().trim().max(500, "Observações muito longas").optional(),
});

export default function CancoesDialog({ open, onOpenChange, culto }: CancoesDialogProps) {
  const [cancoes, setCancoes] = useState<Cancao[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Cancao | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [tom, setTom] = useState("");
  const [bpm, setBpm] = useState<number | undefined>(undefined);
  const [duracaoMinutos, setDuracaoMinutos] = useState<number | undefined>(undefined);
  const [cifra, setCifra] = useState("");
  const [letra, setLetra] = useState("");
  const [linkYoutube, setLinkYoutube] = useState("");
  const [linkSpotify, setLinkSpotify] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [solistaId, setSolistaId] = useState<string>("");
  const [ministroId, setMinistroId] = useState<string>("");

  useEffect(() => {
    if (open && culto) {
      loadCancoes();
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
    } catch (error: unknown) {
      toast.error("Erro ao carregar membros", {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const loadCancoes = async () => {
    if (!culto) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cancoes_culto")
        .select(`
          *,
          solista:profiles!solista_id(nome),
          ministro:profiles!ministro_id(nome)
        `)
        .eq("evento_id", culto.id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setCancoes(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar canções", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitulo("");
    setArtista("");
    setTom("");
    setBpm(undefined);
    setDuracaoMinutos(undefined);
    setCifra("");
    setLetra("");
    setLinkYoutube("");
    setLinkSpotify("");
    setObservacoes("");
    setSolistaId("");
    setMinistroId("");
    setEditando(null);
    setShowForm(false);
  };

  const handleNovaCancao = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditarCancao = (cancao: Cancao) => {
    setEditando(cancao);
    setTitulo(cancao.titulo);
    setArtista(cancao.artista || "");
    setTom(cancao.tom || "");
    setBpm(cancao.bpm || undefined);
    setDuracaoMinutos(cancao.duracao_minutos || undefined);
    setCifra(cancao.cifra || "");
    setLetra(cancao.letra || "");
    setLinkYoutube(cancao.link_youtube || "");
    setLinkSpotify(cancao.link_spotify || "");
    setObservacoes(cancao.observacoes || "");
    setSolistaId(cancao.solista_id || "");
    setMinistroId(cancao.ministro_id || "");
    setShowForm(true);
  };

  const handleSalvar = async () => {
    if (!culto) return;

    try {
      // Validar dados
      const dadosValidados = cancaoSchema.parse({
        titulo: titulo.trim(),
        artista: artista.trim() || undefined,
        tom: tom.trim() || undefined,
        bpm: bpm || undefined,
        duracao_minutos: duracaoMinutos || undefined,
        link_youtube: linkYoutube.trim() || undefined,
        link_spotify: linkSpotify.trim() || undefined,
        cifra: cifra.trim() || undefined,
        letra: letra.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });

      setLoading(true);

      const dadosCancao = {
        titulo: dadosValidados.titulo,
        artista: dadosValidados.artista || null,
        tom: dadosValidados.tom || null,
        bpm: dadosValidados.bpm || null,
        duracao_minutos: dadosValidados.duracao_minutos || null,
        cifra: dadosValidados.cifra || null,
        letra: dadosValidados.letra || null,
        link_youtube: dadosValidados.link_youtube || null,
        link_spotify: dadosValidados.link_spotify || null,
        observacoes: dadosValidados.observacoes || null,
        solista_id: solistaId || null,
        ministro_id: ministroId || null,
      };

      if (editando) {
        const { error } = await supabase
          .from("cancoes_culto")
          .update(dadosCancao)
          .eq("id", editando.id);

        if (error) throw error;
        toast.success("Canção atualizada com sucesso!");
      } else {
        const novaOrdem = cancoes.length > 0 ? Math.max(...cancoes.map(c => c.ordem)) + 1 : 1;
        
        const { error } = await supabase
          .from("cancoes_culto")
          .insert([{
            evento_id: culto.id,
            ...dadosCancao,
            ordem: novaOrdem,
          }]);

        if (error) throw error;
        toast.success("Canção adicionada com sucesso!");
      }

      await loadCancoes();
      resetForm();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast.error("Erro de validação", {
          description: firstError.message
        });
      } else {
        toast.error("Erro ao salvar canção", {
          description: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Deseja remover esta canção?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cancoes_culto")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Canção removida com sucesso!");
      await loadCancoes();
    } catch (error: unknown) {
      toast.error("Erro ao remover canção", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoverOrdem = async (cancao: Cancao, direcao: "up" | "down") => {
    const index = cancoes.findIndex(c => c.id === cancao.id);
    if ((direcao === "up" && index === 0) || (direcao === "down" && index === cancoes.length - 1)) {
      return;
    }

    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    const outraCancao = cancoes[novoIndex];

    setLoading(true);
    try {
      const { error: error1 } = await supabase
        .from("cancoes_culto")
        .update({ ordem: outraCancao.ordem })
        .eq("id", cancao.id);

      const { error: error2 } = await supabase
        .from("cancoes_culto")
        .update({ ordem: cancao.ordem })
        .eq("id", outraCancao.id);

      if (error1 || error2) throw error1 || error2;
      await loadCancoes();
    } catch (error: unknown) {
      toast.error("Erro ao reordenar canção", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  if (!culto) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
            <Music2 className="w-5 h-5" />
            Canções - {culto.titulo}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {cancoes.length} {cancoes.length === 1 ? "canção" : "canções"}
            </p>
            <Button size="sm" onClick={handleNovaCancao} disabled={loading || showForm}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Canção
            </Button>
          </div>

          {/* Formulário */}
          {showForm && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Título *</Label>
                    <Input
                      placeholder="Nome da canção"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  
                  <div>
                    <Label>Artista</Label>
                    <Input
                      placeholder="Nome do artista"
                      value={artista}
                      onChange={(e) => setArtista(e.target.value)}
                      maxLength={200}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Tom</Label>
                      <Input
                        placeholder="Ex: C"
                        value={tom}
                        onChange={(e) => setTom(e.target.value)}
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Label>BPM</Label>
                      <Input
                        type="number"
                        placeholder="120"
                        value={bpm || ""}
                        onChange={(e) => setBpm(e.target.value ? parseInt(e.target.value) : undefined)}
                        min={20}
                        max={300}
                      />
                    </div>
                    <div>
                      <Label>Duração (min)</Label>
                      <Input
                        type="number"
                        placeholder="5"
                        value={duracaoMinutos || ""}
                        onChange={(e) => setDuracaoMinutos(e.target.value ? parseInt(e.target.value) : undefined)}
                        min={1}
                        max={120}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Solista</Label>
                    <Select value={solistaId || "none"} onValueChange={(value) => setSolistaId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o solista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {membros.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Ministro</Label>
                    <Select value={ministroId || "none"} onValueChange={(value) => setMinistroId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ministro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {membros.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Link YouTube</Label>
                    <Input
                      type="url"
                      placeholder="https://youtube.com/..."
                      value={linkYoutube}
                      onChange={(e) => setLinkYoutube(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Link Spotify</Label>
                    <Input
                      type="url"
                      placeholder="https://open.spotify.com/..."
                      value={linkSpotify}
                      onChange={(e) => setLinkSpotify(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Cifra</Label>
                  <Textarea
                    placeholder="Cole a cifra aqui..."
                    value={cifra}
                    onChange={(e) => setCifra(e.target.value)}
                    className="min-h-[100px] font-mono text-sm"
                    maxLength={5000}
                  />
                </div>

                <div>
                  <Label>Letra</Label>
                  <Textarea
                    placeholder="Cole a letra aqui..."
                    value={letra}
                    onChange={(e) => setLetra(e.target.value)}
                    className="min-h-[150px]"
                    maxLength={10000}
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Observações adicionais..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="min-h-[60px]"
                    maxLength={500}
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

          {/* Lista de canções */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {cancoes.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Music2 className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma canção adicionada. Comece criando a lista de canções do culto.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                cancoes.map((cancao, index) => (
                  <Card key={cancao.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-medium">{cancao.titulo}</h4>
                            {cancao.artista && (
                              <Badge variant="outline" className="text-xs">
                                {cancao.artista}
                              </Badge>
                            )}
                            {cancao.tom && (
                              <Badge variant="secondary" className="text-xs">
                                Tom: {cancao.tom}
                              </Badge>
                            )}
                            {cancao.bpm && (
                              <Badge variant="secondary" className="text-xs">
                                {cancao.bpm} BPM
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {cancao.solista && (
                              <span className="flex items-center gap-1">
                                <Guitar className="w-3 h-3" />
                                Solo: {cancao.solista.nome}
                              </span>
                            )}
                            {cancao.ministro && (
                              <span className="flex items-center gap-1">
                                <Mic className="w-3 h-3" />
                                Ministro: {cancao.ministro.nome}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(cancao, "up")}
                            disabled={loading || index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(cancao, "down")}
                            disabled={loading || index === cancoes.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarCancao(cancao)}
                            disabled={loading || showForm}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemover(cancao.id)}
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
        </div>
      </div>
    </ResponsiveDialog>
  );
}