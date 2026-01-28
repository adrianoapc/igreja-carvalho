import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFilialId } from "@/hooks/useFilialId";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Search,
  User,
} from "lucide-react";

interface Responsavel {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Child {
  id: string;
  nome: string;
  data_nascimento: string | null;
  avatar_url: string | null;
  alergias: string | null;
  sexo: string | null;
  tipo_parentesco: string;
}

interface ActiveCheckin {
  id: string;
  crianca_id: string;
  checkin_at: string;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function KidsManualCheckin() {
  const { profile } = useAuth();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Responsavel[]>([]);
  const [selectedResponsavel, setSelectedResponsavel] = useState<Responsavel | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [activeCheckinsMap, setActiveCheckinsMap] = useState<Map<string, ActiveCheckin>>(new Map());
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: cultoHoje, isLoading: cultoLoading } = useQuery({
    queryKey: ["kids-culto-hoje"],
    queryFn: async () => {
      const agora = new Date();
      const inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(agora);
      fim.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento, status")
        .gte("data_evento", inicio.toISOString())
        .lte("data_evento", fim.toISOString())
        .in("status", ["planejado", "confirmado"])
        .order("data_evento", { ascending: true })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, nome, telefone, email, avatar_url")
        .or(
          `nome.ilike.%${searchTerm.trim()}%,telefone.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%`
        )
        .limit(10);

      if (igrejaId) query = query.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;
      if (error) throw error;

      setResults((data as Responsavel[]) || []);
    } catch (error) {
      console.error("Erro ao buscar responsáveis:", error);
      toast.error("Erro ao buscar responsáveis");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSelection = () => {
    setSelectedResponsavel(null);
    setChildren([]);
    setSelectedChildren(new Set());
    setActiveCheckinsMap(new Map());
    setIsCheckoutMode(false);
  };

  useEffect(() => {
    const fetchChildrenAndCheckins = async () => {
      if (!selectedResponsavel) return;

      setIsLoadingChildren(true);
      try {
        const { data: relationships, error: relError } = await supabase
          .from("familias")
          .select("tipo_parentesco, familiar_id")
          .eq("pessoa_id", selectedResponsavel.id);

        if (relError) throw relError;
        if (!relationships || relationships.length === 0) {
          setChildren([]);
          setActiveCheckinsMap(new Map());
          setIsCheckoutMode(false);
          return;
        }

        const familiarIds = relationships.map((r) => r.familiar_id).filter(Boolean);
        if (familiarIds.length === 0) {
          setChildren([]);
          setActiveCheckinsMap(new Map());
          setIsCheckoutMode(false);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nome, data_nascimento, avatar_url, alergias, sexo")
          .in("id", familiarIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        const mappedChildren = relationships
          .filter((r) => r.familiar_id && profileMap.has(r.familiar_id))
          .map((r) => {
            const familiar = profileMap.get(r.familiar_id)!;
            return {
              id: familiar.id,
              nome: familiar.nome,
              data_nascimento: familiar.data_nascimento,
              avatar_url: familiar.avatar_url,
              alergias: familiar.alergias,
              sexo: familiar.sexo,
              tipo_parentesco: r.tipo_parentesco,
            };
          })
          .filter((child) => {
            const age = calculateAge(child.data_nascimento);
            return age !== null && age < 12;
          }) as Child[];

        setChildren(mappedChildren);

        const today = new Date().toISOString().split("T")[0];
        const { data: activeCheckins, error: activeError } = await supabase
          .from("kids_checkins")
          .select("id, crianca_id, checkin_at")
          .eq("responsavel_id", selectedResponsavel.id)
          .gte("checkin_at", `${today}T00:00:00`)
          .is("checkout_at", null);

        if (activeError) throw activeError;

        const map = new Map<string, ActiveCheckin>();
        (activeCheckins || []).forEach((checkin) => {
          map.set(checkin.crianca_id, checkin);
        });
        setActiveCheckinsMap(map);
        setIsCheckoutMode((activeCheckins || []).length > 0);
      } catch (error) {
        console.error("Erro ao carregar crianças:", error);
        toast.error("Erro ao carregar crianças");
      } finally {
        setIsLoadingChildren(false);
      }
    };

    fetchChildrenAndCheckins();
  }, [selectedResponsavel]);

  const selectedChildrenArray = useMemo(
    () => Array.from(selectedChildren),
    [selectedChildren]
  );

  const toggleChild = (childId: string) => {
    const newSelected = new Set(selectedChildren);
    if (newSelected.has(childId)) {
      newSelected.delete(childId);
    } else {
      newSelected.add(childId);
    }
    setSelectedChildren(newSelected);
  };

  const handleCheckin = async () => {
    if (!cultoHoje) {
      toast.error("Não há culto aberto hoje. Cadastre o culto antes do check-in.");
      return;
    }

    if (!selectedResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }

    if (selectedChildrenArray.length === 0) {
      toast.error("Selecione pelo menos uma criança");
      return;
    }

    setIsProcessing(true);
    try {
      if (isCheckoutMode) {
        const checkoutPromises = selectedChildrenArray
          .map((childId) => {
            const checkin = activeCheckinsMap.get(childId);
            if (!checkin) return null;
            return supabase
              .from("kids_checkins")
              .update({
                checkout_at: new Date().toISOString(),
                checkout_por: profile?.id || null,
              })
              .eq("id", checkin.id);
          })
          .filter(Boolean);

        const results = await Promise.all(checkoutPromises as PromiseLike<{ error: { message?: string } | null }>[]);
        const firstError = results.find((r) => r && r.error)?.error;
        if (firstError) {
          toast.error(`Erro ao registrar saída: ${firstError.message || "desconhecido"}`);
          throw firstError;
        }

        toast.success("Saída confirmada com sucesso!");
      } else {
        const checkins = selectedChildrenArray.map((childId) => ({
          crianca_id: childId,
          responsavel_id: selectedResponsavel.id,
          evento_id: cultoHoje.id,
          checkin_por: profile?.id || null,
        }));

        const { error: checkinError } = await supabase
          .from("kids_checkins")
          .insert(checkins);

        if (checkinError) {
          toast.error(`Erro ao registrar check-in: ${checkinError.message || "desconhecido"}`);
          throw checkinError;
        }

        const presencas = selectedChildrenArray.map((childId) => ({
          evento_id: cultoHoje.id,
          pessoa_id: childId,
          metodo: "manual",
          tipo_registro: "kids",
          validado_por: profile?.id ? profile.id : null,
        }));

        const { error: presencaError } = await supabase
          .from("checkins")
          .insert(presencas)
          .select();

        if (presencaError) {
          console.error("Erro Supabase (checkins):", presencaError);
        }

        toast.success("Entrada confirmada com sucesso!");
      }

      setSelectedChildren(new Set());
      setActiveCheckinsMap(new Map());
      setIsCheckoutMode(false);
    } catch (error: unknown) {
      console.error("Erro ao processar check-in manual:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Check-in Manual
        </CardTitle>
        <Button onClick={() => navigate("/kids/scanner")}>
          <Camera className="h-4 w-4 mr-2" />
          Abrir Scanner
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!cultoLoading && !cultoHoje && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhum culto aberto hoje. Cadastre o evento do dia para liberar o check-in.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Buscar responsável por nome, telefone ou email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((res) => (
              <button
                key={res.id}
                type="button"
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedResponsavel?.id === res.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedResponsavel(res)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={res.avatar_url || undefined} />
                    <AvatarFallback>
                      {res.nome
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{res.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {res.telefone || res.email || "Sem contato"}
                    </p>
                  </div>
                  {selectedResponsavel?.id === res.id && (
                    <Badge variant="secondary">Selecionado</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedResponsavel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Crianças vinculadas a {selectedResponsavel.nome}
              </p>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Trocar responsável
              </Button>
            </div>

            {isLoadingChildren && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando crianças...
              </div>
            )}

            {!isLoadingChildren && children.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhuma criança encontrada para este responsável.
              </div>
            )}

            {!isLoadingChildren && children.length > 0 && (
              <div className="space-y-2">
                {children.map((child) => {
                  const isCheckedIn = activeCheckinsMap.has(child.id);
                  const age = calculateAge(child.data_nascimento);

                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <Checkbox
                        checked={selectedChildren.has(child.id)}
                        onCheckedChange={() => toggleChild(child.id)}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={child.avatar_url || undefined} />
                        <AvatarFallback>
                          {child.nome
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{child.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {age !== null ? `${age} anos` : "Idade não informada"}
                        </p>
                      </div>
                      {isCheckedIn && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Presente
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              className="w-full"
              disabled={
                isProcessing ||
                selectedChildrenArray.length === 0 ||
                !selectedResponsavel ||
                !cultoHoje
              }
              onClick={handleCheckin}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isCheckoutMode ? "Registrar Saída" : "Registrar Entrada"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
