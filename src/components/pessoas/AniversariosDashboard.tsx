import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  isToday,
  isThisWeek,
  isThisMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Cake,
  Heart,
  Droplets,
  Phone,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { formatarTelefone } from "@/lib/validators";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface Pessoa {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  data_casamento: string | null;
  data_batismo: string | null;
  status: string;
}

interface AniversarioItem {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data: Date;
  tipo: "nascimento" | "casamento" | "batismo";
  status: string;
}

export function AniversariosDashboard() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [tipoFilter, setTipoFilter] = useState<
    "todos" | "nascimento" | "casamento" | "batismo"
  >("todos");
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();

  useEffect(() => {
    if (authLoading || !igrejaId) return;
    fetchPessoas();
  }, [authLoading, igrejaId, filialId, isAllFiliais]);

  const fetchPessoas = async () => {
    try {
      let query = supabase
        .from("profiles")
        .select(
          "id, nome, telefone, email, data_nascimento, data_casamento, data_batismo, status"
        )
        .order("nome")
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPessoas(data || []);
    } catch (error) {
      console.error("Erro ao buscar pessoas:", error);
    }
  };

  const getAniversarios = (): AniversarioItem[] => {
    const aniversarios: AniversarioItem[] = [];

    pessoas.forEach((pessoa) => {
      if (pessoa.data_nascimento) {
        aniversarios.push({
          id: pessoa.id,
          nome: pessoa.nome,
          telefone: pessoa.telefone,
          email: pessoa.email,
          data: parseISO(pessoa.data_nascimento),
          tipo: "nascimento",
          status: pessoa.status,
        });
      }
      if (pessoa.data_casamento) {
        aniversarios.push({
          id: pessoa.id,
          nome: pessoa.nome,
          telefone: pessoa.telefone,
          email: pessoa.email,
          data: parseISO(pessoa.data_casamento),
          tipo: "casamento",
          status: pessoa.status,
        });
      }
      if (pessoa.data_batismo) {
        aniversarios.push({
          id: pessoa.id,
          nome: pessoa.nome,
          telefone: pessoa.telefone,
          email: pessoa.email,
          data: parseISO(pessoa.data_batismo),
          tipo: "batismo",
          status: pessoa.status,
        });
      }
    });

    return aniversarios;
  };

  const filterAniversarios = (aniversarios: AniversarioItem[]) => {
    let filtered = aniversarios;

    // Filtrar por tipo
    if (tipoFilter !== "todos") {
      filtered = filtered.filter((a) => a.tipo === tipoFilter);
    }

    // Filtrar por data selecionada
    if (selectedDate) {
      filtered = filtered.filter((a) => {
        const aniverDate = new Date(
          selectedDate.getFullYear(),
          a.data.getMonth(),
          a.data.getDate()
        );
        return isSameDay(aniverDate, selectedDate);
      });
    }

    return filtered;
  };

  const groupByPeriod = (aniversarios: AniversarioItem[]) => {
    const hoje: AniversarioItem[] = [];
    const estaSemana: AniversarioItem[] = [];
    const esteMes: AniversarioItem[] = [];

    const now = new Date();

    aniversarios.forEach((aniv) => {
      // Criar data do aniversário no ano atual
      const aniverDate = new Date(
        now.getFullYear(),
        aniv.data.getMonth(),
        aniv.data.getDate()
      );

      if (isToday(aniverDate)) {
        hoje.push(aniv);
      } else if (isThisWeek(aniverDate, { locale: ptBR })) {
        estaSemana.push(aniv);
      } else if (isThisMonth(aniverDate)) {
        esteMes.push(aniv);
      }
    });

    return { hoje, estaSemana, esteMes };
  };

  const allAniversarios = getAniversarios();
  const filteredAniversarios = filterAniversarios(allAniversarios);
  const { hoje, estaSemana, esteMes } = groupByPeriod(filteredAniversarios);

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "nascimento":
        return <Cake className="w-4 h-4" />;
      case "casamento":
        return <Heart className="w-4 h-4" />;
      case "batismo":
        return <Droplets className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "nascimento":
        return "Aniversário";
      case "casamento":
        return "Casamento";
      case "batismo":
        return "Batismo";
      default:
        return "";
    }
  };

  const renderAniversarioCard = (aniv: AniversarioItem) => {
    const now = new Date();
    const aniverDate = new Date(
      now.getFullYear(),
      aniv.data.getMonth(),
      aniv.data.getDate()
    );
    const idade = now.getFullYear() - aniv.data.getFullYear();

    const getTipoBgColor = (tipo: string) => {
      switch (tipo) {
        case "nascimento":
          return "bg-pink-50 border-pink-200";
        case "casamento":
          return "bg-red-50 border-red-200";
        case "batismo":
          return "bg-blue-50 border-blue-200";
        default:
          return "bg-gray-50 border-gray-200";
      }
    };

    const getTipoTextColor = (tipo: string) => {
      switch (tipo) {
        case "nascimento":
          return "text-pink-700";
        case "casamento":
          return "text-red-700";
        case "batismo":
          return "text-blue-700";
        default:
          return "text-gray-700";
      }
    };

    return (
      <div
        key={`${aniv.id}-${aniv.tipo}`}
        className={cn(
          "flex flex-col gap-2 p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
          getTipoBgColor(aniv.tipo)
        )}
        onClick={() => navigate(`/pessoas/${aniv.id}`)}
      >
        <div className="flex items-start gap-2">
          <div className={cn("flex-shrink-0 mt-0.5", getTipoTextColor(aniv.tipo))}>
            {getIcon(aniv.tipo)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{aniv.nome}</p>
            <p className={cn("text-xs font-semibold mt-0.5", getTipoTextColor(aniv.tipo))}>
              {format(aniverDate, "dd 'de' MMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        {aniv.tipo === "nascimento" && (
          <p className="text-xs text-muted-foreground">
            {idade} anos
          </p>
        )}
        {(aniv.telefone || aniv.email) && (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {aniv.telefone && (
              <span className="flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {formatarTelefone(aniv.telefone)}
              </span>
            )}
            {aniv.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{aniv.email}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2">
            <Cake className="w-5 h-5" />
            Aniversários
          </CardTitle>
          <div className="flex flex-col gap-3">
            {/* Filtro Visual de Tipos */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: "todos", label: "Todos", icon: Cake, color: "bg-gray-100 text-gray-800 hover:bg-gray-200" },
                { value: "nascimento", label: "Aniversário", icon: Cake, color: "bg-pink-100 text-pink-800 hover:bg-pink-200" },
                { value: "casamento", label: "Casamento", icon: Heart, color: "bg-red-100 text-red-800 hover:bg-red-200" },
                { value: "batismo", label: "Batismo", icon: Droplets, color: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
              ].map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setTipoFilter(value as typeof tipoFilter)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full transition-colors font-medium text-sm",
                    tipoFilter === value ? color : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Filtro de Data */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {selectedDate
                    ? format(selectedDate, "dd/MM/yyyy")
                    : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                {selectedDate && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedDate(undefined)}
                    >
                      Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {selectedDate ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">
                Aniversários em {format(selectedDate, "dd/MM/yyyy")}
              </h3>
              {filteredAniversarios.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredAniversarios.map((aniv) =>
                    renderAniversarioCard(aniv)
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum aniversário nesta data
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hoje */}
              {hoje.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    🎂 Hoje
                    <Badge variant="default">{hoje.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {hoje.map((aniv) => renderAniversarioCard(aniv))}
                  </div>
                </div>
              )}

              {/* Esta Semana */}
              {estaSemana.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    📅 Esta Semana
                    <Badge variant="secondary">{estaSemana.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {estaSemana.map((aniv) => renderAniversarioCard(aniv))}
                  </div>
                </div>
              )}

              {/* Este Mês */}
              {esteMes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    📆 Este Mês
                    <Badge variant="outline">{esteMes.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {esteMes.map((aniv) => renderAniversarioCard(aniv))}
                  </div>
                </div>
              )}

              {hoje.length === 0 &&
                estaSemana.length === 0 &&
                esteMes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum aniversário próximo
                  </p>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
