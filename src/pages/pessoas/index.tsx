import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserPlus,
  UserCheck,
  PhoneCall,
  ArrowRight,
  FileEdit,
  Heart,
  Search,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AniversariosDashboard } from "@/components/pessoas/AniversariosDashboard";
import { LinksExternosCard } from "@/components/pessoas/LinksExternosCard";
import { PerfisPendentes } from "@/components/pessoas/PerfisPendentes";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { CadastrarPessoaDialog } from "@/components/pessoas/CadastrarPessoaDialog";

export default function Pessoas() {
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [stats, setStats] = useState([
    {
      title: "Total de Pessoas",
      value: "0",
      icon: Users,
      description: "Todas as pessoas cadastradas",
      color: "bg-primary/10 text-primary",
      action: () => navigate("/pessoas/todos"),
    },
    {
      title: "Visitantes",
      value: "0",
      icon: UserPlus,
      description: "Aguardando conversão",
      color: "bg-accent/10 text-accent-foreground",
      action: () => navigate("/pessoas/visitantes"),
    },
    {
      title: "Frequentadores",
      value: "0",
      icon: UserCheck,
      description: "Com acesso ao app",
      color: "bg-secondary/10 text-secondary-foreground",
      action: () => navigate("/pessoas/frequentadores"),
    },
    {
      title: "Membros",
      value: "0",
      icon: Users,
      description: "Membros ativos",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      action: () => navigate("/pessoas/membros"),
    },
  ]);

  const [contatosCount, setContatosCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [aceitaramJesus, setAceitaramJesus] = useState<
    Array<{
      id: string;
      nome: string;
      avatar_url: string | null;
      telefone: string | null;
      email: string | null;
      sexo: string | null;
      data_conversao: string | null;
      status: string;
    }>
  >([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (authLoading || !igrejaId) return;

      try {
        let profilesQuery = supabase
          .from("profiles")
          .select("status")
          .eq("igreja_id", igrejaId);
        if (!isAllFiliais && filialId) {
          profilesQuery = profilesQuery.eq("filial_id", filialId);
        }
        const { data: profiles, error } = await profilesQuery;

        if (error) throw error;

        const total = profiles?.length || 0;
        const visitantes =
          profiles?.filter((p) => p.status === "visitante").length || 0;
        const frequentadores =
          profiles?.filter((p) => p.status === "frequentador").length || 0;
        const membros =
          profiles?.filter((p) => p.status === "membro").length || 0;

        setStats((prev) => [
          { ...prev[0], value: total.toString() },
          { ...prev[1], value: visitantes.toString() },
          { ...prev[2], value: frequentadores.toString() },
          { ...prev[3], value: membros.toString() },
        ]);

        // Buscar contatos agendados (filtrados por igreja/filial)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let contatosQuery = supabase
          .from("visitante_contatos")
          .select("*", { count: "exact", head: true })
          .gte("data_contato", hoje.toISOString())
          .in("status", ["agendado", "pendente"])
          .eq("igreja_id", igrejaId);
        if (!isAllFiliais && filialId) {
          contatosQuery = contatosQuery.eq("filial_id", filialId);
        }
        const { count } = await contatosQuery;

        setContatosCount(count || 0);

        // Buscar alterações pendentes (filtradas)
        let pendentesQuery = supabase
          .from("alteracoes_perfil_pendentes")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente")
          .eq("igreja_id", igrejaId);
        if (!isAllFiliais && filialId) {
          pendentesQuery = pendentesQuery.eq("filial_id", filialId);
        }
        const { count: pendentes } = await pendentesQuery;

        setPendentesCount(pendentes || 0);

        // Buscar pessoas que aceitaram Jesus recentemente (filtradas)
        let aceitaramQuery = supabase
          .from("profiles")
          .select(
            "id, nome, avatar_url, telefone, email, sexo, data_conversao, status"
          )
          .eq("aceitou_jesus", true)
          .not("data_conversao", "is", null)
          .order("data_conversao", { ascending: false })
          .limit(5)
          .eq("igreja_id", igrejaId);
        if (!isAllFiliais && filialId) {
          aceitaramQuery = aceitaramQuery.eq("filial_id", filialId);
        }
        const { data: aceitaram } = await aceitaramQuery;

        setAceitaramJesus(aceitaram || []);
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
      }
    };

    fetchStats();
  }, [authLoading, igrejaId, filialId, isAllFiliais]);

  const quickActions = [
    {
      title: "Visitantes",
      description: "Gerenciar e promover visitantes",
      icon: UserPlus,
      path: "/pessoas/visitantes",
      count: stats[1].value,
      label: "cadastrados",
    },
    {
      title: "Membros",
      description: "Visualizar e editar perfis de membros",
      icon: Users,
      path: "/pessoas/membros",
      count: stats[3].value,
      label: "ativos",
    },
    {
      title: "Contatos Agendados",
      description: "Acompanhar contatos com visitantes",
      icon: PhoneCall,
      path: "/pessoas/contatos",
      count: contatosCount.toString(),
      label: "agendados",
    },
    {
      title: "Frequentadores",
      description: "Pessoas com múltiplas visitas",
      icon: UserCheck,
      path: "/pessoas/frequentadores",
      count: stats[2].value,
      label: "ativos",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Pessoas
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Dashboard centralizado de gestão de pessoas
        </p>
      </div>

      {/* Search Bar + Register Button */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pessoa por nome, email ou telefone..."
                className="pl-10 text-sm md:text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchTerm.trim()) {
                    navigate(
                      `/pessoas/todos?buscar=${encodeURIComponent(searchTerm)}`
                    );
                  }
                }}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                  onClick={() => {
                    if (searchTerm.trim()) {
                      navigate(
                        `/pessoas/todos?buscar=${encodeURIComponent(searchTerm)}`
                      );
                    }
                  }}
                >
                  Buscar
                </Button>
              )}
            </div>
            <Button
              onClick={() => setCadastrarOpen(true)}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Pessoa
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={`cursor-pointer transition-all hover:shadow-md ${
                stat.action ? "hover:scale-105" : ""
              }`}
              onClick={stat.action}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {stat.title}
                    </p>
                    <h3 className="text-xl md:text-2xl font-bold mt-1">
                      {stat.value}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {stat.description}
                    </p>
                  </div>
                  <div
                    className={`p-2 md:p-3 rounded-full ${stat.color} flex-shrink-0`}
                  >
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Acesso Rápido</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="grid grid-cols-1 gap-3 md:gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.title}
                  className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => action.path !== "#" && navigate(action.path)}
                >
                  <div className="p-2 md:p-3 rounded-full bg-primary/10 flex-shrink-0">
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <h3 className="font-semibold text-sm md:text-base truncate">
                        {action.title}
                      </h3>
                      <Badge variant="secondary" className="text-xs w-fit">
                        {action.count} {action.label}
                      </Badge>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Perfis Pendentes de Aprovação */}
      <Card>
        <CardHeader className="p-4 md:p-6 flex flex-row items-center justify-between">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            Alterações Pendentes
            {pendentesCount > 0 && (
              <Badge variant="destructive">{pendentesCount}</Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/pessoas/alteracoes-pendentes")}
          >
            Ver histórico
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          {pendentesCount > 0 ? (
            <PerfisPendentes />
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Nenhuma alteração pendente de aprovação</p>
              <p className="text-xs mt-1">
                Alterações externas de perfis aparecerão aqui
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Links Externos de Cadastro */}
      <LinksExternosCard />

      {/* Pessoas que Aceitaram Jesus */}
      {aceitaramJesus.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Aceitaram Jesus
              <Badge variant="secondary">{aceitaramJesus.length}</Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/pessoas/todos?aceitou_jesus=true")}
            >
              Ver todos
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="space-y-3">
              {aceitaramJesus.map((pessoa) => (
                <div
                  key={pessoa.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/pessoas/${pessoa.id}`)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={pessoa.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {pessoa.nome?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {pessoa.nome}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {pessoa.telefone || pessoa.email || "Sem contato"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {pessoa.sexo && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {pessoa.sexo}
                        </span>
                      )}
                      {pessoa.data_conversao && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(pessoa.data_conversao).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs capitalize shrink-0"
                  >
                    {pessoa.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aniversários Dashboard */}
      <AniversariosDashboard />

      {/* Recent Activity */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="text-center py-6 md:py-8 text-muted-foreground">
            <p className="text-sm md:text-base">Nenhuma atividade recente</p>
            <p className="text-xs md:text-sm mt-1">
              As últimas interações com pessoas aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Cadastro */}
      <CadastrarPessoaDialog
        open={cadastrarOpen}
        onOpenChange={setCadastrarOpen}
        onSuccess={() => {
          // Recarregar estatísticas
          window.location.reload();
        }}
      />
    </div>
  );
}
