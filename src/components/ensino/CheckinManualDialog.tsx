import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Baby, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Sala {
  id: string;
  nome: string;
}

interface AulaAtiva {
  id: string;
  tema: string | null;
  data_inicio: string;
  duracao_minutos: number;
}

interface CheckinManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sala: Sala | null;
  onSuccess?: () => void;
}

export function CheckinManualDialog({ open, onOpenChange, sala, onSuccess }: CheckinManualDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAula, setLoadingAula] = useState(false);
  const [aulaAtiva, setAulaAtiva] = useState<AulaAtiva | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (open && sala) {
      setResults([]);
      setSelectedChildId(null);
      setSearch("");
      loadAulaAtiva();
    }
  }, [open, sala]);

  const loadAulaAtiva = async () => {
    if (!sala) return;
    setLoadingAula(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("aulas")
        .select("id, tema, data_inicio, duracao_minutos")
        .eq("sala_id", sala.id)
        .gte("data_inicio", startOfDay.toISOString())
        .lte("data_inicio", endOfDay.toISOString())
        .order("data_inicio", { ascending: true });

      if (error) throw error;

      const aulasHoje = data || [];
      const aulaAtivaOuProxima =
        aulasHoje.find((a) => {
          const start = new Date(a.data_inicio);
          const end = new Date(start.getTime() + (a.duracao_minutos || 60) * 60000);
          return now >= start && now <= end;
        }) || aulasHoje[0];

      setAulaAtiva(aulaAtivaOuProxima || null);
    } catch (err) {
      console.error("Erro ao buscar aula ativa:", err);
      toast.error("Erro ao buscar aula ativa");
      setAulaAtiva(null);
    } finally {
      setLoadingAula(false);
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, data_nascimento")
        .ilike("nome", `%${search.trim()}%`)
        .limit(10);

      if (error) throw error;

      const today = new Date();
      const filtered = (data || []).filter((p) => {
        if (!p.data_nascimento) return true;
        const birth = new Date(p.data_nascimento);
        const age =
          today.getFullYear() -
          birth.getFullYear() -
          (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
        return age < 12;
      });

      setResults(filtered);
    } catch (err) {
      console.error("Erro ao buscar crianças:", err);
      toast.error("Erro ao buscar crianças");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!aulaAtiva) {
      toast.error("Nenhuma aula ativa encontrada");
      return;
    }
    if (!selectedChildId) {
      toast.error("Selecione uma criança");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("presencas_aula").insert({
        aula_id: aulaAtiva.id,
        aluno_id: selectedChildId,
        checkin_at: new Date().toISOString(),
        status: "presente",
      });

      if (error) {
        if (error.message?.toLowerCase().includes("constraint") || error.code === "23505") {
          toast.error("Esta criança já possui um check-in aberto nesta aula.");
        } else {
          toast.error("Erro ao realizar check-in");
        }
        throw error;
      }

      toast.success("Check-in registrado!");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro check-in manual:", err);
    } finally {
      setLoading(false);
    }
  };

  const aulaInfo = useMemo(() => {
    if (!aulaAtiva) return null;
    const start = new Date(aulaAtiva.data_inicio);
    return `${aulaAtiva.tema || "Aula"} • ${format(start, "HH:mm", { locale: ptBR })}`;
  }, [aulaAtiva]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-pink-500" />
            Check-in Manual
          </DialogTitle>
          <DialogDescription>
            {sala ? `Sala ${sala.nome}` : "Selecione uma sala"} <br />
            {aulaInfo || "Buscando aula ativa..."}
          </DialogDescription>
        </DialogHeader>

        {loadingAula ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando aula...
          </div>
        ) : !aulaAtiva ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-3 text-sm">
            <AlertCircle className="w-4 h-4" />
            Nenhuma aula ativa hoje para esta sala.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar criança pelo nome"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma criança encontrada</p>
              ) : (
                results.map((kid) => (
                  <div
                    key={kid.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${
                      selectedChildId === kid.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedChildId(kid.id)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={kid.avatar_url || undefined} />
                      <AvatarFallback>{kid.nome?.substring(0, 2)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{kid.nome}</p>
                      {kid.data_nascimento && (
                        <p className="text-xs text-muted-foreground">
                          Nasc.: {format(new Date(kid.data_nascimento), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCheckin} disabled={loading || !aulaAtiva}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Realizar Check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
