import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Music2, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Edit, 
  Mic, 
  User,
  ExternalLink,
  GripVertical
} from "lucide-react";

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

interface MusicaTabContentProps {
  eventoId: string;
}

export default function MusicaTabContent({ eventoId }: MusicaTabContentProps) {
  const [cancoes, setCancoes] = useState<Cancao[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Cancao | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [tom, setTom] = useState("");
  const [bpm, setBpm] = useState<string>("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("");
  const [cifra, setCifra] = useState("");
  const [letra, setLetra] = useState("");
  const [linkYoutube, setLinkYoutube] = useState("");
  const [linkSpotify, setLinkSpotify] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [solistaId, setSolistaId] = useState<string>("");
  const [ministroId, setMinistroId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [eventoId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cancoesRes, membrosRes] = await Promise.all([
        supabase
          .from("cancoes_culto")
          .select(`
            *,
            solista:profiles!solista_id(nome),
            ministro:profiles!ministro_id(nome)
          `)
          .eq("evento_id", eventoId)
          .order("ordem", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, nome")
          .eq("status", "membro")
          .order("nome", { ascending: true })
      ]);

      if (cancoesRes.error) throw cancoesRes.error;
      if (membrosRes.error) throw membrosRes.error;

      setCancoes(cancoesRes.data || []);
      setMembros(membrosRes.data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar dados", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitulo("");
    setArtista("");
    setTom("");
    setBpm("");
    setDuracaoMinutos("");
    setCifra("");
    setLetra("");
    setLinkYoutube("");
    setLinkSpotify("");
    setObservacoes("");
    setSolistaId("");
    setMinistroId("");
    setEditando(null);
  };

  const handleEdit = (cancao: Cancao) => {
    setEditando(cancao);
    setTitulo(cancao.titulo);
    setArtista(cancao.artista || "");
    setTom(cancao.tom || "");
    setBpm(cancao.bpm?.toString() || "");
    setDuracaoMinutos(cancao.duracao_minutos?.toString() || "");
    setCifra(cancao.cifra || "");
    setLetra(cancao.letra || "");
    setLinkYoutube(cancao.link_youtube || "");
    setLinkSpotify(cancao.link_spotify || "");
    setObservacoes(cancao.observacoes || "");
    setSolistaId(cancao.solista_id || "");
    setMinistroId(cancao.ministro_id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const dadosCancao = {
        titulo: titulo.trim(),
        artista: artista.trim() || null,
        tom: tom.trim() || null,
        bpm: bpm ? parseInt(bpm) : null,
        duracao_minutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
        cifra: cifra.trim() || null,
        letra: letra.trim() || null,
        link_youtube: linkYoutube.trim() || null,
        link_spotify: linkSpotify.trim() || null,
        observacoes: observacoes.trim() || null,
        solista_id: solistaId || null,
        ministro_id: ministroId || null,
      };

      if (editando) {
        const { error } = await supabase
          .from("cancoes_culto")
          .update(dadosCancao)
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Música atualizada!");
      } else {
        const novaOrdem = cancoes.length > 0 ? Math.max(...cancoes.map(c => c.ordem)) + 1 : 1;
        const { error } = await supabase
          .from("cancoes_culto")
          .insert([{ evento_id: eventoId, ...dadosCancao, ordem: novaOrdem }]);
        if (error) throw error;
        toast.success("Música adicionada!");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao salvar", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta música?")) return;
    try {
      const { error } = await supabase.from("cancoes_culto").delete().eq("id", id);
      if (error) throw error;
      toast.success("Música removida!");
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao remover", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleReorder = async (cancao: Cancao, direcao: "up" | "down") => {
    const index = cancoes.findIndex(c => c.id === cancao.id);
    if ((direcao === "up" && index === 0) || (direcao === "down" && index === cancoes.length - 1)) return;

    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    const outraCancao = cancoes[novoIndex];

    try {
      await Promise.all([
        supabase.from("cancoes_culto").update({ ordem: outraCancao.ordem }).eq("id", cancao.id),
        supabase.from("cancoes_culto").update({ ordem: cancao.ordem }).eq("id", outraCancao.id)
      ]);
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao reordenar", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleUpdatePessoa = async (cancaoId: string, campo: "solista_id" | "ministro_id", value: string) => {
    try {
      const { error } = await supabase
        .from("cancoes_culto")
        .update({ [campo]: value || null })
        .eq("id", cancaoId);
      if (error) throw error;
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao atualizar", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  if (loading && cancoes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Music2 className="h-5 w-5" />
          Repertório ({cancoes.length} músicas)
        </h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Música
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar Música" : "Nova Música"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Título *</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome da música" />
                </div>
                <div>
                  <Label>Artista</Label>
                  <Input value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Nome do artista" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Tom</Label>
                    <Input value={tom} onChange={(e) => setTom(e.target.value)} placeholder="C" />
                  </div>
                  <div>
                    <Label>BPM</Label>
                    <Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="120" />
                  </div>
                  <div>
                    <Label>Duração</Label>
                    <Input type="number" value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} placeholder="5" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ministro (quem puxa)</Label>
                  <Select value={ministroId || "none"} onValueChange={(v) => setMinistroId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Solista</Label>
                  <Select value={solistaId || "none"} onValueChange={(v) => setSolistaId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Link YouTube</Label>
                  <Input value={linkYoutube} onChange={(e) => setLinkYoutube(e.target.value)} placeholder="https://youtube.com/..." />
                </div>
                <div>
                  <Label>Link Spotify</Label>
                  <Input value={linkSpotify} onChange={(e) => setLinkSpotify(e.target.value)} placeholder="https://open.spotify.com/..." />
                </div>
              </div>
              <div>
                <Label>Cifra</Label>
                <Textarea value={cifra} onChange={(e) => setCifra(e.target.value)} className="min-h-[80px] font-mono text-sm" />
              </div>
              <div>
                <Label>Letra</Label>
                <Textarea value={letra} onChange={(e) => setLetra(e.target.value)} className="min-h-[100px]" />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="min-h-[60px]" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cancoes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma música adicionada ao repertório.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cancoes.map((cancao, index) => (
            <Card key={cancao.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Ordem e Drag */}
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReorder(cancao, "up")} disabled={index === 0}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-bold text-muted-foreground">{cancao.ordem}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReorder(cancao, "down")} disabled={index === cancoes.length - 1}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Info Principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{cancao.titulo}</h4>
                      {cancao.tom && <Badge variant="outline">{cancao.tom}</Badge>}
                      {cancao.bpm && <Badge variant="secondary">{cancao.bpm} BPM</Badge>}
                      {cancao.duracao_minutos && <Badge variant="secondary">{cancao.duracao_minutos} min</Badge>}
                    </div>
                    {cancao.artista && <p className="text-sm text-muted-foreground">{cancao.artista}</p>}
                    
                    {/* Links */}
                    {(cancao.link_youtube || cancao.link_spotify) && (
                      <div className="flex gap-2 mt-2">
                        {cancao.link_youtube && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => window.open(cancao.link_youtube!, "_blank")}>
                            <ExternalLink className="h-3 w-3 mr-1" />YouTube
                          </Button>
                        )}
                        {cancao.link_spotify && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => window.open(cancao.link_spotify!, "_blank")}>
                            <ExternalLink className="h-3 w-3 mr-1" />Spotify
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selects Ministro/Solista */}
                  <div className="flex gap-2 items-center">
                    <div className="w-40">
                      <Label className="text-xs flex items-center gap-1 mb-1"><User className="h-3 w-3" />Ministro</Label>
                      <Select 
                        value={cancao.ministro_id || "none"} 
                        onValueChange={(v) => handleUpdatePessoa(cancao.id, "ministro_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <Label className="text-xs flex items-center gap-1 mb-1"><Mic className="h-3 w-3" />Solista</Label>
                      <Select 
                        value={cancao.solista_id || "none"} 
                        onValueChange={(v) => handleUpdatePessoa(cancao.id, "solista_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cancao)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cancao.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
