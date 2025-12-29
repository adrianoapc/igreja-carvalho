import { useEffect, useMemo, useState } from "react";
import { supabase as supa } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Bell, Loader2, MessageCircle, Plus, Smartphone, Trash2, Users, ArrowLeft, RefreshCw, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- TIPOS ---
const APP_ROLES = ["admin", "pastor", "lider", "secretario", "tesoureiro", "intercessor", "membro", "basico"] as const;
type AppRole = (typeof APP_ROLES)[number];
type CanalKey = "inapp" | "push" | "whatsapp";

interface NotificacaoEvento {
  slug: string;
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  provider_preferencial?: string | null;
  variaveis?: string[] | null;
  template_meta?: string | null;
}

interface NotificacaoRegra {
  id: string;
  evento_slug: string;
  role_alvo?: string | null;
  user_id_especifico?: string | null;
  canais?: Record<string, boolean> | null;
  ativo?: boolean | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  lider: "Líder",
  secretario: "Secretaria",
  tesoureiro: "Tesouraria",
  intercessor: "Intercessão",
  membro: "Membro",
  basico: "Básico",
};

// --- HELPER FUNCTIONS ---
function formatEventoNome(evento?: string | null) {
  if (!evento) return "Evento";
  return evento.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getRegraCanais(regra: NotificacaoRegra) {
  const canais = regra.canais || {};
  return {
    inapp: canais.inapp ?? true,
    push: canais.push ?? false,
    whatsapp: canais.whatsapp ?? false,
  };
}

// --- SUB-COMPONENTE: CARD DO EVENTO ---
const NotificationEventCard = ({
  evento,
  regras,
  onAddRegra,
  onDeleteRegra,
  onToggleCanal,
  loadingIds,
}: {
  evento: NotificacaoEvento;
  regras: NotificacaoRegra[];
  onAddRegra: (evento: string) => void;
  onDeleteRegra: (id: string) => void;
  onToggleCanal: (id: string, canal: CanalKey) => void;
  loadingIds: Record<string, boolean>;
}) => {
  const titulo = evento.nome || formatEventoNome(evento.slug);
  const waProvider = evento.provider_preferencial;

  return (
    <Card className="flex flex-col h-full border-l-4 border-l-primary/20 shadow-sm hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 bg-slate-50/30">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {titulo}
              {waProvider && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal bg-green-50 text-green-700 border-green-200">
                  {waProvider === 'meta_direto' ? 'Meta API' : 'Make'}
                </Badge>
              )}
            </CardTitle>
          <CardDescription className="line-clamp-2 text-xs text-muted-foreground/80">
            {evento.template_meta || evento.descricao || "Sem descrição definida."}
          </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shadow-sm" onClick={() => onAddRegra(evento.slug)}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-slate-100">
              <TableHead className="w-[40%] h-9 text-xs font-medium text-slate-500 pl-4">Destinatário</TableHead>
              <TableHead className="w-[15%] h-9 text-center p-0" title="Notificação no App"><Bell className="w-3.5 h-3.5 mx-auto text-slate-400" /></TableHead>
              <TableHead className="w-[15%] h-9 text-center p-0" title="Push Notification"><Smartphone className="w-3.5 h-3.5 mx-auto text-slate-400" /></TableHead>
              <TableHead className="w-[15%] h-9 text-center p-0" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5 mx-auto text-slate-400" /></TableHead>
              <TableHead className="w-[15%] h-9"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-xs italic bg-slate-50/20">
                  Ninguém configurado para receber.
                </TableCell>
              </TableRow>
            ) : (
              regras.map((regra) => {
                const canais = getRegraCanais(regra);
                const role = regra.role_alvo;
                const label = role ? ROLE_LABELS[role] || role : "Usuário Específico";
                const isWaActive = canais.whatsapp;

                return (
                  <TableRow key={regra.id} className={`text-sm group transition-colors ${isWaActive ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-slate-50'}`}>
                    <TableCell className="font-medium py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[120px] text-slate-700" title={label}>{label}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="p-0 text-center">
                      <div className="flex justify-center">
                        <Switch 
                          checked={canais.inapp} 
                          onCheckedChange={() => onToggleCanal(regra.id, 'inapp')}
                          disabled={loadingIds[`${regra.id}-inapp`]}
                          className="scale-75 data-[state=checked]:bg-primary"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="p-0 text-center">
                      <div className="flex justify-center">
                        <Switch 
                          checked={canais.push} 
                          onCheckedChange={() => onToggleCanal(regra.id, 'push')}
                          disabled={loadingIds[`${regra.id}-push`]}
                          className="scale-75 data-[state=checked]:bg-sky-500"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="p-0 text-center">
                      <div className="flex justify-center relative">
                         <Switch 
                          checked={canais.whatsapp} 
                          onCheckedChange={() => onToggleCanal(regra.id, 'whatsapp')}
                          disabled={loadingIds[`${regra.id}-whatsapp`]}
                          className="scale-75 data-[state=checked]:bg-green-600"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-right py-2 pr-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                        onClick={() => onDeleteRegra(regra.id)}
                        disabled={loadingIds[regra.id]}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// --- COMPONENTE PRINCIPAL ---
interface Props {
  onBack?: () => void;
}

export default function NotificacoesAdmin({ onBack }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  
  const [eventos, setEventos] = useState<NotificacaoEvento[]>([]);
  const [regras, setRegras] = useState<NotificacaoRegra[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOps, setLoadingOps] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDados();
  }, []);

  const loadDados = async () => {
    try {
      setLoading(true);
      const [resEventos, resRegras] = await Promise.all([
        supa.from("notificacao_eventos").select("*"),
        supa.from("notificacao_regras").select("*")
      ]);

      if (resEventos.error) throw resEventos.error;
      if (resRegras.error) throw resRegras.error;

      setEventos(resEventos.data || []);
      setRegras((resRegras.data || []).map(r => ({
        ...r,
        canais: r.canais as Record<string, boolean> | null
      })));
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Falha ao carregar configurações.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCanal = async (regraId: string, canal: CanalKey) => {
    const regra = regras.find(r => r.id === regraId);
    if (!regra) return;

    const current = getRegraCanais(regra);
    const newValue = !current[canal];
    const newCanais = { ...current, [canal]: newValue };
    
    // Optimistic Update
    const oldRegras = [...regras];
    setRegras(prev => prev.map(r => r.id === regraId ? { ...r, canais: newCanais, [`canal_${canal}`]: newValue } : r));
    setLoadingOps(prev => ({ ...prev, [`${regraId}-${canal}`]: true }));

    try {
      const payload = { canais: newCanais };
      const { error } = await supa.from("notificacao_regras").update(payload).eq("id", regraId);
      if (error) throw error;
      
      toast({ 
        description: `Canal ${canal.toUpperCase()} ${newValue ? 'ativado' : 'desativado'}.`,
        duration: 2000,
        className: "bg-background border-border"
      });

    } catch (err) {
      setRegras(oldRegras);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setLoadingOps(prev => ({ ...prev, [`${regraId}-${canal}`]: false }));
    }
  };

  const handleAddRegra = async () => {
    if (!selectedEventSlug || !selectedRole) return;
    setCreating(true);

    try {
      const payload = {
        evento_slug: selectedEventSlug,
        role_alvo: selectedRole,
        canais: { inapp: true, push: false, whatsapp: false },
        ativo: true
      };

      const { data, error } = await supa.from("notificacao_regras").insert(payload).select().single();
      if (error) throw error;

      setRegras(prev => [...prev, { ...data, canais: data.canais as Record<string, boolean> | null }]);
      toast({ title: "Regra criada com sucesso!", className: "bg-green-50 border-green-200 text-green-800" });
      setDialogOpen(false);
      setSelectedRole("");
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao criar regra", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRegra = async (id: string) => {
    setLoadingOps(prev => ({ ...prev, [id]: true }));
    try {
      const { error } = await supa.from("notificacao_regras").delete().eq("id", id);
      if (error) throw error;
      setRegras(prev => prev.filter(r => r.id !== id));
      toast({ description: "Regra removida." });
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setLoadingOps(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredEventos = useMemo(() => {
    if (!searchTerm) return eventos;
    const q = searchTerm.toLowerCase();
    return eventos.filter(ev => {
      const nome = ev.nome || formatEventoNome(ev.slug);
      return (
        nome.toLowerCase().includes(q) ||
        (ev.descricao || "").toLowerCase().includes(q) ||
        (ev.categoria || "").toLowerCase().includes(q) ||
        ev.slug.toLowerCase().includes(q)
      );
    });
  }, [eventos, searchTerm]);

  const eventosPorCategoria = useMemo(() => {
    const groups: Record<string, NotificacaoEvento[]> = {};
    filteredEventos.forEach(ev => {
      const cat = ev.categoria || "Geral";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ev);
    });
    return groups;
  }, [filteredEventos]);

  // Auto-expand categories when search matches
  useEffect(() => {
    if (!searchTerm) return;
    const next = new Set<string>();
    Object.keys(eventosPorCategoria).forEach(cat => next.add(cat));
    setExpandedCategories(next);
  }, [searchTerm, eventosPorCategoria]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (loading) return <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p>Carregando central...</p></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-primary">Central de Notificações</h1>
            <p className="text-muted-foreground mt-1 text-sm">Configure as regras de disparo automático para toda a igreja.</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-help">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>WhatsApp gera custos</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Envios ativos (iniciados pelo sistema) consomem saldo da API. Use com sabedoria.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            placeholder="Buscar evento, categoria ou descrição"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); loadDados(); }} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>
      </div>

      {/* Grid de Categorias */}
      {Object.keys(eventosPorCategoria).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground space-y-2">
            <Bell className="h-6 w-6 mx-auto" />
            <p>Nenhum evento encontrado para esse filtro.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(eventosPorCategoria).map(([categoria, listaEventos]) => {
          const expanded = expandedCategories.has(categoria);
          return (
            <section key={categoria} className="border border-border/60 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition"
                onClick={() => toggleCategory(categoria)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                <span className="font-semibold uppercase text-xs tracking-wider">{categoria}</span>
                <span className="text-xs text-muted-foreground">{listaEventos.length} evento(s)</span>
              </button>

              {expanded && (
                <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-6 bg-card/40">
                  {listaEventos.map(evento => (
                    <NotificationEventCard
                      key={evento.slug}
                      evento={evento}
                      regras={regras.filter(r => r.evento_slug === evento.slug)}
                      onAddRegra={(slug) => {
                        setSelectedEventSlug(slug);
                        setDialogOpen(true);
                      }}
                      onDeleteRegra={handleDeleteRegra}
                      onToggleCanal={handleToggleCanal}
                      loadingIds={loadingOps}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {/* Dialog Nova Regra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Novo Destinatário</DialogTitle>
            <DialogDescription>
              Quem receberá alertas de <strong className="text-foreground">{formatEventoNome(selectedEventSlug)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="role" className="text-sm font-medium">Cargo / Função</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddRegra} disabled={creating || !selectedRole}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
