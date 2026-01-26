import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  AlertCircle,
} from "lucide-react";
import { extractEdgeFunctionPayload } from "./edgeFunctionPayload";

interface CheckinManualSearchProps {
  eventoId: string;
  onCheckinSuccess?: () => void;
}

interface SearchResult {
  id: string;
  qr_token: string;
  status_pagamento: string | null;
  checkin_validado_em: string | null;
  pessoa: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
  } | null;
}

export function CheckinManualSearch({
  eventoId,
  onCheckinSuccess,
}: CheckinManualSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  const isUUID = (str: string) =>
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      let query = supabase
        .from("inscricoes_eventos")
        .select(`
          id,
          qr_token,
          status_pagamento,
          checkin_validado_em,
          pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (
            id,
            nome,
            telefone,
            email
          )
        `)
        .eq("evento_id", eventoId)
        .is("cancelado_em", null);

      if (isUUID(searchTerm.trim())) {
        query = query.eq("qr_token", searchTerm.trim());
      } else {
        // Busca por nome ou telefone usando textSearch
        const { data: profileIds } = await supabase
          .from("profiles")
          .select("id")
          .or(
            `nome.ilike.%${searchTerm.trim()}%,telefone.ilike.%${searchTerm.trim()}%`
          );

        if (profileIds && profileIds.length > 0) {
          query = query.in(
            "pessoa_id",
            profileIds.map((p) => p.id)
          );
        } else {
          setResults([]);
          setIsSearching(false);
          return;
        }
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;
      setResults((data as unknown as SearchResult[]) || []);
    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar inscrições");
    } finally {
      setIsSearching(false);
    }
  };

  const checkinMutation = useMutation({
    mutationFn: async (qrToken: string) => {
      const { data, error } = await supabase.functions.invoke(
        "checkin-inscricao",
        {
          body: { qr_token: qrToken },
        }
      );

      const payload = extractEdgeFunctionPayload(data, error);
      if (payload) return payload;
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Check-in confirmado: ${data.pessoa?.nome}`);
        queryClient.invalidateQueries({ queryKey: ["checkins-recentes"] });
        queryClient.invalidateQueries({ queryKey: ["checkin-stats"] });
        onCheckinSuccess?.();
        // Atualizar resultados localmente
        setResults((prev) =>
          prev.map((r) =>
            r.qr_token === data.qr_token
              ? { ...r, checkin_validado_em: new Date().toISOString() }
              : r
          )
        );
      } else {
        toast.error(data.message || "Erro ao realizar check-in");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Busca Manual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome, telefone ou token..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
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
            {results.map((result) => {
              const pessoa = Array.isArray(result.pessoa)
                ? result.pessoa[0]
                : result.pessoa;
              const jaUsado = !!result.checkin_validado_em;

              return (
                <div
                  key={result.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium truncate">
                        {pessoa?.nome || "Nome não disponível"}
                      </p>
                    </div>
                    {pessoa?.telefone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {pessoa.telefone}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      {jaUsado && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Presente
                        </Badge>
                      )}
                      {result.status_pagamento && (
                        <Badge
                          variant={
                            result.status_pagamento.toLowerCase() === "pago" ||
                            result.status_pagamento.toLowerCase() === "isento"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {result.status_pagamento}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={jaUsado || checkinMutation.isPending}
                    onClick={() => checkinMutation.mutate(result.qr_token)}
                  >
                    {checkinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : jaUsado ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      "Check-in"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {results.length === 0 && searchTerm && !isSearching && (
          <div className="text-center py-4 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma inscrição encontrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
