import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, History, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface HistoricoItem {
  id: string;
  candidato_id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  observacoes: string | null;
  realizado_por: string | null;
  created_at: string;
  candidato?: {
    nome_contato: string;
    ministerio: string;
  };
  realizador?: {
    nome: string;
  };
}

const acaoLabels: Record<string, string> = {
  criado: "Candidatura Registrada",
  status_alterado: "Status Alterado",
  trilha_vinculada: "Trilha Vinculada",
  avaliado: "Avaliado",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em Análise",
  aprovado: "Aprovado",
  em_trilha: "Em Trilha",
  rejeitado: "Rejeitado",
};

export default function Historico() {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchHistorico();
  }, []);

  const fetchHistorico = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidatos_voluntario_historico")
      .select(`
        *,
        candidato:candidatos_voluntario(nome_contato, ministerio),
        realizador:profiles!candidatos_voluntario_historico_realizado_por_fkey(nome)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      setHistorico(data as unknown as HistoricoItem[]);
    }
    setLoading(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getAcaoBadge = (acao: string) => {
    const styles: Record<string, string> = {
      criado: "bg-blue-50 text-blue-700 border-blue-200",
      status_alterado: "bg-yellow-50 text-yellow-700 border-yellow-200",
      trilha_vinculada: "bg-purple-50 text-purple-700 border-purple-200",
      avaliado: "bg-green-50 text-green-700 border-green-200",
    };
    return (
      <Badge variant="outline" className={styles[acao] || ""}>
        {acaoLabels[acao] || acao}
      </Badge>
    );
  };

  const filteredHistorico = historico.filter((h) =>
    h.candidato?.nome_contato?.toLowerCase().includes(search.toLowerCase()) ||
    h.candidato?.ministerio?.toLowerCase().includes(search.toLowerCase()) ||
    h.realizador?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/voluntariado/candidatos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Histórico de Movimentações</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Rastreabilidade de ações no voluntariado
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Registro de Atividades
          </CardTitle>
          <CardDescription>
            Todas as movimentações e aprovações de candidatos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, ministério ou responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : filteredHistorico.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Realizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistorico.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(item.candidato?.nome_contato)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{item.candidato?.nome_contato || "—"}</p>
                            <p className="text-xs text-muted-foreground">{item.candidato?.ministerio}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getAcaoBadge(item.acao)}</TableCell>
                      <TableCell className="text-sm">
                        {item.acao === "status_alterado" ? (
                          <span>
                            {statusLabels[item.status_anterior || ""] || item.status_anterior} →{" "}
                            <span className="font-medium">
                              {statusLabels[item.status_novo || ""] || item.status_novo}
                            </span>
                          </span>
                        ) : (
                          item.observacoes || "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.realizador?.nome || "Sistema"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
