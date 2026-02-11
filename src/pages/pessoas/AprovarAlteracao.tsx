import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface AlteracaoPendente {
  id: string;
  profile_id: string;
  dados_novos: Record<string, any>;
  dados_antigos: Record<string, any>;
  status: string;
  created_at: string;
  profile?: {
    id: string;
    nome: string;
    avatar_url: string | null;
    data_nascimento: string | null;
    status: string;
  };
}

const fieldLabels: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  data_nascimento: "Data de Nascimento",
  sexo: "Sexo",
  estado_civil: "Estado Civil",
  endereco: "Endereço",
  cidade: "Cidade",
  estado: "Estado",
  cep: "CEP",
  bairro: "Bairro",
};

export default function AprovarAlteracao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { igrejaId, isAllFiliais } = useIgrejaId();
  const { filialId } = useFilialId();

  const [alteracao, setAlteracao] = useState<AlteracaoPendente | null>(null);
  const [loading, setLoading] = useState(true);
  const [camposAprovados, setCamposAprovados] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    loadAlteracao();
  }, [id]);

  const loadAlteracao = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("alteracoes_perfil_pendentes")
        .select(
          `
          id,
          profile_id,
          dados_novos,
          dados_antigos,
          status,
          created_at
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url, data_nascimento, status")
          .eq("id", data.profile_id)
          .single();

        setAlteracao({
          ...data,
          profile: profile || undefined,
        });

        // Inicializar campos aprovados como true por padrão
        const campos = getChangedFields(data.dados_novos, data.dados_antigos);
        const inicial: Record<string, boolean> = {};
        campos.forEach((campo) => {
          inicial[campo] = true;
        });
        setCamposAprovados(inicial);
      }
    } catch (error) {
      console.error("Erro ao carregar alteração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a alteração.",
        variant: "destructive",
      });
      navigate("/pessoas/alteracoes-pendentes");
    } finally {
      setLoading(false);
    }
  };

  const getChangedFields = (
    novos: Record<string, any>,
    antigos: Record<string, any>,
  ): string[] => {
    const campos: string[] = [];
    for (const key in novos) {
      if (novos[key] !== antigos[key]) {
        campos.push(key);
      }
    }
    return campos;
  };

  const formatValue = (campo: string, value: any): string => {
    if (value === null || value === undefined || value === "")
      return "Não informado";

    if (campo === "data_nascimento" && value) {
      try {
        return format(new Date(value), "dd/MM/yyyy");
      } catch {
        return value;
      }
    }

    if (campo === "sexo") {
      return value === "M" ? "Masculino" : value === "F" ? "Feminino" : value;
    }

    return String(value);
  };

  const handleToggleCampo = (campo: string) => {
    setCamposAprovados((prev) => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  const handleAprovar = async () => {
    if (!alteracao || !igrejaId) return;

    setLoading(true);
    try {
      const updateData: Record<string, any> = {};

      Object.keys(camposAprovados).forEach((campo) => {
        if (camposAprovados[campo]) {
          updateData[campo] = alteracao.dados_novos[campo];
        }
      });

      if (Object.keys(updateData).length > 0) {
        let updateProfileQuery = supabase
          .from("profiles")
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", alteracao.profile_id)
          .eq("igreja_id", igrejaId);

        if (!isAllFiliais && filialId) {
          updateProfileQuery = updateProfileQuery.eq("filial_id", filialId);
        }

        const { error: updateError } = await updateProfileQuery;
        if (updateError) throw updateError;
      }

      let statusQuery = supabase
        .from("alteracoes_perfil_pendentes")
        .update({
          status: "aprovado",
          campos_aprovados: camposAprovados,
        })
        .eq("id", alteracao.id)
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        statusQuery = statusQuery.eq("filial_id", filialId);
      }

      const { error: statusError } = await statusQuery;
      if (statusError) throw statusError;

      toast({
        title: "Alteração aprovada",
        description: `${Object.keys(camposAprovados).filter((k) => camposAprovados[k]).length} campos foram atualizados.`,
      });

      navigate("/pessoas/alteracoes-pendentes");
    } catch (error) {
      console.error("Erro ao aprovar alteração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível aprovar a alteração.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!alteracao || !igrejaId) return;

    setLoading(true);
    try {
      let rejectQuery = supabase
        .from("alteracoes_perfil_pendentes")
        .update({ status: "rejeitado" })
        .eq("id", alteracao.id)
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        rejectQuery = rejectQuery.eq("filial_id", filialId);
      }

      const { error } = await rejectQuery;
      if (error) throw error;

      toast({
        title: "Alteração rejeitada",
        description: "Todas as alterações foram recusadas.",
      });

      navigate("/pessoas/alteracoes-pendentes");
    } catch (error) {
      console.error("Erro ao rejeitar alteração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar a alteração.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!alteracao) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Alteração não encontrada</p>
        <Button onClick={() => navigate("/pessoas/alteracoes-pendentes")}>
          Voltar
        </Button>
      </div>
    );
  }

  const changedFields = getChangedFields(
    alteracao.dados_novos,
    alteracao.dados_antigos,
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/pessoas/alteracoes-pendentes")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Aprovar Alteração de Perfil
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analise e aprove as alterações solicitadas
            </p>
          </div>
        </div>
      </div>

      {/* Card de Informações do Perfil */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 md:col-span-2">
              <Avatar className="h-16 w-16 flex-shrink-0">
                <AvatarImage src={alteracao.profile?.avatar_url || ""} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold truncate">
                  {alteracao.profile?.nome}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Nasc:{" "}
                  {alteracao.profile?.data_nascimento
                    ? format(
                        new Date(alteracao.profile.data_nascimento),
                        "dd/MM/yyyy",
                      )
                    : "Não informado"}
                </p>
                <p className="text-sm text-muted-foreground">Igreja Carvalho</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:col-span-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/pessoas/${alteracao.profile_id}`)}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver perfil completo
              </Button>
              <Badge variant="secondary" className="justify-center">
                {alteracao.profile?.status === "membro"
                  ? "Membro"
                  : alteracao.profile?.status === "frequentador"
                    ? "Frequentador"
                    : "Visitante"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="destructive"
          onClick={handleRejeitar}
          disabled={loading}
          className="w-full"
        >
          Recusar
        </Button>
        <Button
          onClick={handleAprovar}
          disabled={loading || changedFields.length === 0}
          className="w-full"
        >
          Aprovar
        </Button>
      </div>

      {/* Lista de Campos Alterados */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Campos alterados ({changedFields.length})
        </h2>

        {changedFields.map((campo) => (
          <Card key={campo}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_120px] gap-4 items-start">
                <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start md:gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {fieldLabels[campo] || campo}
                  </p>
                </div>

                <div className="p-3 bg-red-50 rounded border border-red-200/50">
                  <p className="text-xs text-red-600 font-medium mb-1">De:</p>
                  <p className="text-sm font-semibold text-red-900 break-words">
                    {formatValue(campo, alteracao.dados_antigos[campo])}
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded border border-green-200/50">
                  <p className="text-xs text-green-600 font-medium mb-1">
                    Para:
                  </p>
                  <p className="text-sm font-semibold text-green-900 break-words">
                    {formatValue(campo, alteracao.dados_novos[campo])}
                  </p>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end md:justify-start md:gap-2">
                  <span
                    className={`text-xs font-medium ${camposAprovados[campo] ? "text-green-600" : "text-muted-foreground"}`}
                  >
                    {camposAprovados[campo] ? "✓ Aprovar" : "○ Não aprovar"}
                  </span>
                  <Switch
                    checked={camposAprovados[campo] || false}
                    onCheckedChange={() => handleToggleCampo(campo)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {changedFields.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Nenhuma alteração detectada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
