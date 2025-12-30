import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Users, UserPlus, X, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { avaliarTriagemVoluntario, getRegraMinisterio, type TriagemResultado } from "@/lib/voluntariado/triagem";

interface Time {
  id: string;
  nome: string;
  categoria: string;
  cor: string | null;
}

interface Posicao {
  id: string;
  time_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface MembroTime {
  id: string;
  time_id: string;
  pessoa_id: string;
  posicao_id: string | null;
  data_entrada: string | null;
  ativo: boolean;
  profiles: {
    nome: string;
    email: string | null;
  };
  posicoes_time: {
    nome: string;
  } | null;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  status: string;
}

interface ConflictInfo {
  conflito_detectado: boolean;
  time_nome: string;
  evento_titulo?: string;
  evento_data?: string;
  culto_titulo?: string;
  culto_data?: string;
}

interface PendenciaTrilha {
  id: string;
  pessoa_id: string;
  concluido: boolean | null;
  profiles: {
    nome: string;
    email: string | null;
  };
}

interface GerenciarTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  time: Time | null;
}

export default function GerenciarTimeDialog({ open, onOpenChange, time }: GerenciarTimeDialogProps) {
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [membros, setMembros] = useState<MembroTime[]>([]);
  const [novaPosicao, setNovaPosicao] = useState("");
  const [descricaoPosicao, setDescricaoPosicao] = useState("");
  const [posicaoEditando, setPosicaoEditando] = useState<Posicao | null>(null);
  const [posicaoParaDeletar, setPosicaoParaDeletar] = useState<string | null>(null);
  const [membroParaDeletar, setMembroParaDeletar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddMembro, setShowAddMembro] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<string>("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<string>("");
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [triagemAtual, setTriagemAtual] = useState<TriagemResultado | null>(null);
  const [inscricaoTrilha, setInscricaoTrilha] = useState<{ id: string; concluido: boolean | null } | null>(null);
  const [pendenciasTrilha, setPendenciasTrilha] = useState<PendenciaTrilha[]>([]);
  const [carregandoPendencias, setCarregandoPendencias] = useState(false);

  useEffect(() => {
    if (open && time) {
      loadPosicoes();
      loadMembros();
      loadPessoas();
    }
  }, [open, time]);

  const loadPosicoes = async () => {
    if (!time) return;

    try {
      const { data, error } = await supabase
        .from("posicoes_time")
        .select("*")
        .eq("time_id", time.id)
        .order("nome", { ascending: true });

      if (error) throw error;
      setPosicoes(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar posições", {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const loadMembros = async () => {
    if (!time) return;

    try {
      const { data, error } = await supabase
        .from("membros_time")
        .select(`
          *,
          profiles:pessoa_id(nome, email),
          posicoes_time:posicao_id(nome)
        `)
        .eq("time_id", time.id)
        .eq("ativo", true)
        .order("profiles(nome)", { ascending: true });

      if (error) throw error;
      setMembros(data || []);
      await loadPendenciasTrilha(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar membros", {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const loadPessoas = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, status")
        .in("status", ["membro", "frequentador"])
        .order("nome", { ascending: true });

      if (error) throw error;
      setPessoas(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar pessoas", {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleAdicionarPosicao = async () => {
    if (!time || !novaPosicao.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("posicoes_time")
        .insert({
          time_id: time.id,
          nome: novaPosicao.trim(),
          descricao: descricaoPosicao.trim() || null,
          ativo: true
        });

      if (error) throw error;
      
      toast.success("Posição adicionada com sucesso!");
      setNovaPosicao("");
      setDescricaoPosicao("");
      loadPosicoes();
    } catch (error: unknown) {
      toast.error("Erro ao adicionar posição", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizarPosicao = async () => {
    if (!posicaoEditando) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("posicoes_time")
        .update({
          nome: novaPosicao.trim(),
          descricao: descricaoPosicao.trim() || null
        })
        .eq("id", posicaoEditando.id);

      if (error) throw error;
      
      toast.success("Posição atualizada com sucesso!");
      setNovaPosicao("");
      setDescricaoPosicao("");
      setPosicaoEditando(null);
      loadPosicoes();
    } catch (error: unknown) {
      toast.error("Erro ao atualizar posição", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletarPosicao = async () => {
    if (!posicaoParaDeletar) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("posicoes_time")
        .delete()
        .eq("id", posicaoParaDeletar);

      if (error) throw error;
      
      toast.success("Posição removida com sucesso!");
      setPosicaoParaDeletar(null);
      loadPosicoes();
      loadMembros();
    } catch (error: unknown) {
      toast.error("Erro ao remover posição", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const buscarJornadaIdPorTitulo = async (titulo: string) => {
    const { data, error } = await supabase
      .from("jornadas")
      .select("id")
      .eq("titulo", titulo)
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  };

  const carregarInscricaoTrilha = async (pessoaId: string, trilhaTitulo: string) => {
    try {
      const jornadaId = await buscarJornadaIdPorTitulo(trilhaTitulo);
      if (!jornadaId) {
        setInscricaoTrilha(null);
        return;
      }

      const { data, error } = await supabase
        .from("inscricoes_jornada")
        .select("id, concluido")
        .eq("pessoa_id", pessoaId)
        .eq("jornada_id", jornadaId)
        .maybeSingle();

      if (error) throw error;
      setInscricaoTrilha(data ? { id: data.id, concluido: data.concluido } : null);
    } catch (error: unknown) {
      console.error("Erro ao carregar inscrição da trilha:", error);
      setInscricaoTrilha(null);
    }
  };

  const loadPendenciasTrilha = async (membrosAtuais: MembroTime[]) => {
    if (!time) return;

    const regra = getRegraMinisterio({ nome: time.nome, categoria: time.categoria });
    if (!regra) {
      setPendenciasTrilha([]);
      return;
    }

    setCarregandoPendencias(true);
    try {
      const jornadaId = await buscarJornadaIdPorTitulo(regra.trilhaTitulo);
      if (!jornadaId) {
        setPendenciasTrilha([]);
        return;
      }

      const { data, error } = await supabase
        .from("inscricoes_jornada")
        .select("id, pessoa_id, concluido, profiles:pessoa_id(nome, email)")
        .eq("jornada_id", jornadaId);

      if (error) throw error;

      const membrosIds = new Set(membrosAtuais.map((membro) => membro.pessoa_id));
      const pendencias = (data || []).filter((inscricao) => !membrosIds.has(inscricao.pessoa_id));
      setPendenciasTrilha(pendencias as PendenciaTrilha[]);
    } catch (error: unknown) {
      console.error("Erro ao carregar pendências de trilha:", error);
      setPendenciasTrilha([]);
    } finally {
      setCarregandoPendencias(false);
    }
  };

  const checkConflito = async (pessoaId: string, cultoData: string) => {
    if (!pessoaId || !cultoData) return;

    setCheckingConflict(true);
    setConflictInfo(null);
    
    try {
      const { data, error } = await supabase.rpc("check_voluntario_conflito", {
        p_voluntario_id: pessoaId,
        p_data_inicio: cultoData,
        p_duracao_minutos: 120, // 2 horas padrão
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const conflito = data[0];
        if (conflito.conflito_detectado) {
          setConflictInfo(conflito);
          setShowConflictWarning(true);
        }
      }
    } catch (error: unknown) {
      console.error("Erro ao verificar conflito:", error);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSelecionarPessoa = async (pessoaId: string) => {
    setPessoaSelecionada(pessoaId);
    setConflictInfo(null);
    setShowConflictWarning(false);
    setInscricaoTrilha(null);

    if (time) {
      const pessoa = pessoas.find((item) => item.id === pessoaId);
      if (pessoa) {
        const triagem = avaliarTriagemVoluntario(pessoa.status, {
          nome: time.nome,
          categoria: time.categoria,
        });
        setTriagemAtual(triagem);
        if (triagem.trilhaTitulo) {
          await carregarInscricaoTrilha(pessoaId, triagem.trilhaTitulo);
        }
      }
    }

    // Buscar próximo culto para verificar conflito
    const { data: proximoCulto } = await supabase
      .from("eventos")
      .select("data_evento")
      .gte("data_evento", new Date().toISOString())
      .order("data_evento", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (proximoCulto) {
      await checkConflito(pessoaId, proximoCulto.data_evento);
    }
  };

  const handleAdicionarMembro = async () => {
    if (!time || !pessoaSelecionada) {
      toast.error("Selecione uma pessoa");
      return;
    }

    if (showConflictWarning && conflictInfo) {
      const titulo = conflictInfo.evento_titulo || conflictInfo.culto_titulo || "";
      const confirmar = window.confirm(
        `⚠️ ATENÇÃO: Esta pessoa já está escalada em "${conflictInfo.time_nome}" para o evento "${titulo}".\n\nDeseja adicionar mesmo assim?`
      );
      if (!confirmar) return;
    }

    setLoading(true);
    try {
      const pessoa = pessoas.find((item) => item.id === pessoaSelecionada);
      const triagem = pessoa && time
        ? avaliarTriagemVoluntario(pessoa.status, { nome: time.nome, categoria: time.categoria })
        : null;

      if (triagem?.status === "em_trilha") {
        if (!triagem.trilhaTitulo) {
          toast.error("Trilha obrigatória não encontrada para este ministério.");
          return;
        }

        const jornadaId = await buscarJornadaIdPorTitulo(triagem.trilhaTitulo);
        if (!jornadaId) {
          toast.error("Trilha não encontrada. Verifique o cadastro de jornadas.");
          return;
        }

        const { data: inscricaoExistente, error: inscricaoErro } = await supabase
          .from("inscricoes_jornada")
          .select("id, concluido")
          .eq("pessoa_id", pessoaSelecionada)
          .eq("jornada_id", jornadaId)
          .maybeSingle();

        if (inscricaoErro) throw inscricaoErro;

        if (inscricaoExistente?.concluido) {
          // Trilha concluída, pode aprovar direto no time.
        } else {
          if (!inscricaoExistente) {
            const { error: insertErro } = await supabase
              .from("inscricoes_jornada")
              .insert({
                jornada_id: jornadaId,
                pessoa_id: pessoaSelecionada,
                data_entrada: new Date().toISOString(),
                concluido: false,
              });

            if (insertErro) throw insertErro;
          }

          toast.success("Pendência de trilha criada!", {
            description: `Trilha: ${triagem.trilhaTitulo}`,
          });
          setPessoaSelecionada("");
          setPosicaoSelecionada("");
          setShowAddMembro(false);
          setConflictInfo(null);
          setShowConflictWarning(false);
          setTriagemAtual(null);
          setInscricaoTrilha(null);
          await loadMembros();
          return;
        }
      }

      const { error } = await supabase
        .from("membros_time")
        .insert({
          time_id: time.id,
          pessoa_id: pessoaSelecionada,
          posicao_id: posicaoSelecionada || null,
          data_entrada: new Date().toISOString().split('T')[0],
          ativo: true
        });

      if (error) throw error;
      
      toast.success("Membro adicionado ao time!");
      setPessoaSelecionada("");
      setPosicaoSelecionada("");
      setShowAddMembro(false);
      setConflictInfo(null);
      setShowConflictWarning(false);
      setTriagemAtual(null);
      setInscricaoTrilha(null);
      loadMembros();
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        toast.error("Esta pessoa já está neste time com esta posição");
      } else {
        toast.error("Erro ao adicionar membro", {
          description: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverMembro = async () => {
    if (!membroParaDeletar) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("membros_time")
        .delete()
        .eq("id", membroParaDeletar);

      if (error) throw error;
      
      toast.success("Membro removido do time!");
      setMembroParaDeletar(null);
      loadMembros();
    } catch (error: unknown) {
      toast.error("Erro ao remover membro", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const pessoasFiltradas = pessoas.filter(p => 
    p.nome.toLowerCase().includes(buscaPessoa.toLowerCase()) ||
    p.email?.toLowerCase().includes(buscaPessoa.toLowerCase())
  );

  const statusTriagemLabel = () => {
    if (!triagemAtual) return null;
    if (triagemAtual.status === "aprovado") return "Aprovado";
    if (inscricaoTrilha?.concluido) return "Aprovado";
    return "Em trilha";
  };

  const statusTriagemBadge = () => {
    const status = statusTriagemLabel();
    if (!status) return null;
    if (status === "Aprovado") {
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">{status}</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">{status}</Badge>;
  };

  if (!time) return null;

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <div className="flex flex-col h-full">
          <DialogTitle className="sr-only">
            {time ? `Gerenciar time ${time.nome}` : "Gerenciar time"}
          </DialogTitle>
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="flex items-center gap-3 text-lg font-semibold leading-none tracking-tight">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: time.cor || '#8B5CF6' }}
              >
                <Users className="w-5 h-5 text-white" />
              </div>
              {time.nome}
            </h2>
            <p className="text-sm text-muted-foreground">Gerencie os membros e informações deste time</p>
          </div>

          <ScrollArea className="flex-1 overflow-hidden">
            <div className="px-4 py-4 md:px-6 md:py-5">

          <Tabs defaultValue="posicoes" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="posicoes">Posições ({posicoes.length})</TabsTrigger>
              <TabsTrigger value="membros">Membros ({membros.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="posicoes" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
              {/* Adicionar/Editar Posição */}
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base">
                    {posicaoEditando ? "Editar Posição" : "Nova Posição"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="nome-posicao">Nome da Posição *</Label>
                    <Input
                      id="nome-posicao"
                      value={novaPosicao}
                      onChange={(e) => setNovaPosicao(e.target.value)}
                      placeholder="Ex: Vocal, Guitarrista, Operador de Som"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao-posicao">Descrição</Label>
                    <Input
                      id="descricao-posicao"
                      value={descricaoPosicao}
                      onChange={(e) => setDescricaoPosicao(e.target.value)}
                      placeholder="Descrição das responsabilidades"
                      maxLength={200}
                    />
                  </div>
                  <div className="flex gap-2">
                    {posicaoEditando && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setNovaPosicao("");
                          setDescricaoPosicao("");
                          setPosicaoEditando(null);
                        }}
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      onClick={posicaoEditando ? handleAtualizarPosicao : handleAdicionarPosicao}
                      disabled={!novaPosicao.trim() || loading}
                      size="sm"
                      className="bg-gradient-primary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {posicaoEditando ? "Atualizar" : "Adicionar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Posições */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {posicoes.map((posicao) => (
                    <Card key={posicao.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{posicao.nome}</h4>
                              {!posicao.ativo && (
                                <Badge variant="secondary">Inativa</Badge>
                              )}
                            </div>
                            {posicao.descricao && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {posicao.descricao}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPosicaoEditando(posicao);
                                setNovaPosicao(posicao.nome);
                                setDescricaoPosicao(posicao.descricao || "");
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPosicaoParaDeletar(posicao.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {posicoes.length === 0 && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nenhuma posição cadastrada. Adicione a primeira posição acima.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="membros" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
              {/* Adicionar Membro */}
              {!showAddMembro ? (
                <Button
                  onClick={() => setShowAddMembro(true)}
                  className="bg-gradient-primary"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Membro
                </Button>
              ) : (
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Adicionar Membro</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddMembro(false);
                          setPessoaSelecionada("");
                          setPosicaoSelecionada("");
                          setBuscaPessoa("");
                          setTriagemAtual(null);
                          setInscricaoTrilha(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="busca-pessoa">Buscar Pessoa</Label>
                      <Input
                        id="busca-pessoa"
                        value={buscaPessoa}
                        onChange={(e) => setBuscaPessoa(e.target.value)}
                        placeholder="Digite o nome ou email..."
                      />
                    </div>
                    <ScrollArea className="h-40 border rounded-lg">
                      <div className="p-2 space-y-1">
                        {pessoasFiltradas.map((pessoa) => (
                          <button
                            key={pessoa.id}
                            onClick={() => handleSelecionarPessoa(pessoa.id)}
                            className={`w-full text-left p-2 rounded-md hover:bg-muted transition-colors ${
                              pessoaSelecionada === pessoa.id ? "bg-muted" : ""
                            }`}
                          >
                            <p className="font-medium text-sm">{pessoa.nome}</p>
                            {pessoa.email && (
                              <p className="text-xs text-muted-foreground">{pessoa.email}</p>
                            )}
                          </button>
                        ))}
                        {pessoasFiltradas.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center p-4">
                            Nenhuma pessoa encontrada
                          </p>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Alerta de Conflito */}
                    {checkingConflict && (
                      <Alert>
                        <Clock className="h-4 w-4 animate-spin" />
                        <AlertDescription>Verificando disponibilidade...</AlertDescription>
                      </Alert>
                    )}

                    {showConflictWarning && conflictInfo && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-semibold">⚠️ Conflito Detectado</p>
                          <p className="text-sm mt-1">
                            Esta pessoa já está escalada em <strong>{conflictInfo.time_nome}</strong>{" "}
                            para o culto <strong>"{conflictInfo.culto_titulo}"</strong>{" "}
                            em{" "}
                            {new Date(conflictInfo.culto_data).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                            .
                          </p>
                          <p className="text-xs mt-2 italic">
                            Você pode continuar, mas considere verificar a disponibilidade.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {triagemAtual && (
                      <Alert>
                        {statusTriagemLabel() === "Aprovado" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                        <AlertDescription className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Status da inscrição:</span>
                            {statusTriagemBadge()}
                          </div>
                          {triagemAtual.motivo && (
                            <p className="text-sm text-muted-foreground">{triagemAtual.motivo}</p>
                          )}
                          {triagemAtual.trilhaTitulo && (
                            <p className="text-sm">
                              Trilha indicada: <span className="font-semibold">{triagemAtual.trilhaTitulo}</span>
                            </p>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="posicao-membro">Posição (opcional)</Label>
                      <select
                        id="posicao-membro"
                        value={posicaoSelecionada}
                        onChange={(e) => setPosicaoSelecionada(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Sem posição específica</option>
                        {posicoes.filter(p => p.ativo).map((posicao) => (
                          <option key={posicao.id} value={posicao.id}>
                            {posicao.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={handleAdicionarMembro}
                      disabled={!pessoaSelecionada || loading || checkingConflict}
                      className="w-full bg-gradient-primary"
                    >
                      {statusTriagemLabel() === "Em trilha"
                        ? "Criar pendência de trilha"
                        : showConflictWarning
                          ? "Adicionar Mesmo Assim"
                          : "Adicionar ao Time"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Membros */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {pendenciasTrilha.length > 0 && (
                    <Card className="border-dashed">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">Pendências de Trilha</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                        {carregandoPendencias && (
                          <p className="text-sm text-muted-foreground">Carregando pendências...</p>
                        )}
                        {pendenciasTrilha.map((pendencia) => (
                          <div key={pendencia.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{pendencia.profiles.nome}</p>
                              {pendencia.profiles.email && (
                                <p className="text-xs text-muted-foreground">{pendencia.profiles.email}</p>
                              )}
                            </div>
                            <Badge
                              variant={pendencia.concluido ? "default" : "secondary"}
                              className={
                                pendencia.concluido
                                  ? "bg-green-500/20 text-green-700 border-green-500/30"
                                  : "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
                              }
                            >
                              {pendencia.concluido ? "Aprovado" : "Em trilha"}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {membros.map((membro) => (
                    <Card key={membro.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{membro.profiles.nome}</h4>
                              {membro.posicoes_time && (
                                <Badge variant="outline">
                                  {membro.posicoes_time.nome}
                                </Badge>
                              )}
                              <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                                Aprovado
                              </Badge>
                            </div>
                            {membro.profiles.email && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {membro.profiles.email}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMembroParaDeletar(membro.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {membros.length === 0 && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nenhum membro neste time. Adicione o primeiro membro acima.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
      </ResponsiveDialog>

      {/* Confirmação de Deletar Posição */}
      <AlertDialog open={!!posicaoParaDeletar} onOpenChange={() => setPosicaoParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Posição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta posição? Esta ação não pode ser desfeita.
              Membros com esta posição ficarão sem posição definida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletarPosicao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Remover Membro */}
      <AlertDialog open={!!membroParaDeletar} onOpenChange={() => setMembroParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro do time?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoverMembro} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
