import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, UserPlus, Ticket } from "lucide-react";

interface Evento {
  id: string;
  titulo: string;
  requer_pagamento: boolean | null;
  valor_inscricao: number | null;
  categoria_financeira_id: string | null;
  conta_financeira_id: string | null;
}

interface Lote {
  id: string;
  nome: string;
  valor: number;
  vagas_limite: number | null;
  vagas_utilizadas: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
}

interface AdicionarInscricaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string;
  evento?: Evento | null;
  onSuccess: () => void;
}

export function AdicionarInscricaoDialog({
  open,
  onOpenChange,
  eventoId,
  evento,
}: AdicionarInscricaoDialogProps & { onSuccess: () => void }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPessoaId, setSelectedPessoaId] = useState<string | null>(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [statusPagamento, setStatusPagamento] = useState("pendente");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inscritosIds, setInscritosIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadPessoas();
      loadInscritos();
      loadLotes();
    }
  }, [open, eventoId]);

  const loadPessoas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone, avatar_url")
        .order("nome");

      if (error) throw error;
      setPessoas(data || []);
    } catch (error) {
      console.error("Erro ao carregar pessoas:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInscritos = async () => {
    try {
      const { data, error } = await supabase
        .from("inscricoes_eventos")
        .select("pessoa_id")
        .eq("evento_id", eventoId);

      if (error) throw error;
      setInscritosIds(data?.map(i => i.pessoa_id) || []);
    } catch (error) {
      console.error("Erro ao carregar inscritos:", error);
    }
  };

  const loadLotes = async () => {
    try {
      const { data, error } = await supabase
        .from("evento_lotes")
        .select("*")
        .eq("evento_id", eventoId)
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;
      
      // Filtrar lotes disponíveis (vigência e vagas)
      const now = new Date();
      const lotesDisponiveis = (data || []).filter((lote: Lote) => {
        if (lote.vigencia_inicio && new Date(lote.vigencia_inicio) > now) return false;
        if (lote.vigencia_fim && new Date(lote.vigencia_fim) < now) return false;
        if (lote.vagas_limite && lote.vagas_utilizadas >= lote.vagas_limite) return false;
        return true;
      });
      
      setLotes(lotesDisponiveis);
      
      // Se só tem um lote, seleciona automaticamente
      if (lotesDisponiveis.length === 1) {
        setSelectedLoteId(lotesDisponiveis[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar lotes:", error);
    }
  };

  const getValorInscricao = () => {
    if (selectedLoteId) {
      const lote = lotes.find(l => l.id === selectedLoteId);
      return lote?.valor || 0;
    }
    return evento?.valor_inscricao || 0;
  };

  const handleSubmit = async () => {
    if (!selectedPessoaId) {
      toast.error("Selecione uma pessoa");
      return;
    }

    setSaving(true);
    try {
      // Verificar se já está inscrito
      if (inscritosIds.includes(selectedPessoaId)) {
        toast.error("Esta pessoa já está inscrita neste evento");
        return;
      }

      const valorFinal = getValorInscricao();

      // Se pagamento confirmado e evento pago, criar transação
      let transacaoId: string | null = null;
      if (statusPagamento === "pago" && evento?.requer_pagamento && evento.conta_financeira_id && valorFinal > 0) {
        const lote = selectedLoteId ? lotes.find(l => l.id === selectedLoteId) : null;
        const descricaoTx = lote 
          ? `Inscrição - ${evento.titulo} (${lote.nome})`
          : `Inscrição - ${evento.titulo}`;

        const { data: transacao, error: txError } = await supabase
          .from("transacoes_financeiras")
          .insert({
            tipo: "entrada",
            tipo_lancamento: "avulso",
            descricao: descricaoTx,
            valor: valorFinal,
            data_vencimento: new Date().toISOString().split("T")[0],
            data_pagamento: new Date().toISOString().split("T")[0],
            data_competencia: new Date().toISOString().split("T")[0],
            status: "pago",
            conta_id: evento.conta_financeira_id,
            categoria_id: evento.categoria_financeira_id,
          })
          .select()
          .single();

        if (txError) throw txError;
        transacaoId = transacao.id;
      }

      const { error } = await supabase
        .from("inscricoes_eventos")
        .insert({
          evento_id: eventoId,
          pessoa_id: selectedPessoaId,
          status_pagamento: statusPagamento,
          transacao_id: transacaoId,
          lote_id: selectedLoteId,
          valor_pago: statusPagamento === "pago" ? valorFinal : 0,
        });

      if (error) throw error;

      toast.success("Inscrição adicionada!");
      onOpenChange(false);
      setSelectedPessoaId(null);
      setSelectedLoteId(null);
      setSearchTerm("");
      setStatusPagamento("pendente");
    } catch (error: unknown) {
      toast.error("Erro ao adicionar inscrição", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredPessoas = pessoas.filter(p => 
    !inscritosIds.includes(p.id) && (
      p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const selectedPessoa = pessoas.find(p => p.id === selectedPessoaId);
  const selectedLote = lotes.find(l => l.id === selectedLoteId);
  const hasLotes = lotes.length > 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Inscrito
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Busca */}
          <div className="space-y-2">
            <Label>Buscar Pessoa</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Lista de Pessoas */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[180px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredPessoas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {searchTerm ? "Nenhuma pessoa encontrada" : "Digite para buscar"}
                  </p>
                ) : (
                  filteredPessoas.slice(0, 20).map((pessoa) => (
                    <button
                      key={pessoa.id}
                      type="button"
                      onClick={() => setSelectedPessoaId(pessoa.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors ${
                        selectedPessoaId === pessoa.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={pessoa.avatar_url || undefined} />
                        <AvatarFallback>{pessoa.nome?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="text-left flex-1">
                        <p className="font-medium text-sm">{pessoa.nome}</p>
                        <p className="text-xs text-muted-foreground">{pessoa.email || pessoa.telefone || "—"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Pessoa Selecionada */}
          {selectedPessoa && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">Selecionado:</p>
              <p className="font-medium">{selectedPessoa.nome}</p>
            </div>
          )}

          {/* Seleção de Lote (se houver lotes) */}
          {hasLotes && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Categoria / Lote
              </Label>
              <Select 
                value={selectedLoteId || ""} 
                onValueChange={(val) => setSelectedLoteId(val || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote..." />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{lote.nome}</span>
                        <Badge variant="secondary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lote.valor)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLote && selectedLote.vagas_limite && (
                <p className="text-xs text-muted-foreground">
                  {selectedLote.vagas_utilizadas}/{selectedLote.vagas_limite} vagas utilizadas
                </p>
              )}
            </div>
          )}

          {/* Status de Pagamento */}
          <div className="space-y-2">
            <Label>Status de Pagamento</Label>
            <Select value={statusPagamento} onValueChange={setStatusPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                {evento?.requer_pagamento && (
                  <SelectItem value="pago">Pago</SelectItem>
                )}
                <SelectItem value="isento">Isento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          {evento?.requer_pagamento && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor da inscrição:</p>
              <p className="font-bold text-lg">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(getValorInscricao())}
              </p>
              {selectedLote && (
                <p className="text-xs text-muted-foreground mt-1">Lote: {selectedLote.nome}</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving || !selectedPessoaId || (hasLotes && !selectedLoteId)}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Adicionar
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
