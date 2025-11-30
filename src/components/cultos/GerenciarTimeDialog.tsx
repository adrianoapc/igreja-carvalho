import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Users, UserPlus, X } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
    } catch (error: any) {
      toast.error("Erro ao carregar posições", {
        description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao carregar membros", {
        description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao carregar pessoas", {
        description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao adicionar posição", {
        description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao atualizar posição", {
        description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao remover posição", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdicionarMembro = async () => {
    if (!time || !pessoaSelecionada) {
      toast.error("Selecione uma pessoa");
      return;
    }

    setLoading(true);
    try {
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
      loadMembros();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Esta pessoa já está neste time com esta posição");
      } else {
        toast.error("Erro ao adicionar membro", {
          description: error.message
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
    } catch (error: any) {
      toast.error("Erro ao remover membro", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const pessoasFiltradas = pessoas.filter(p => 
    p.nome.toLowerCase().includes(buscaPessoa.toLowerCase()) ||
    p.email?.toLowerCase().includes(buscaPessoa.toLowerCase())
  );

  if (!time) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: time.cor || '#8B5CF6' }}
              >
                <Users className="w-5 h-5 text-white" />
              </div>
              {time.nome}
            </DialogTitle>
            <DialogDescription>
              Gerencie as posições e membros deste time
            </DialogDescription>
          </DialogHeader>

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
                            onClick={() => setPessoaSelecionada(pessoa.id)}
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
                      disabled={!pessoaSelecionada || loading}
                      className="w-full bg-gradient-primary"
                    >
                      Adicionar ao Time
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Membros */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
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
        </DialogContent>
      </Dialog>

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
