import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Baby, Users, LogIn, Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KidsRoomOccupancy } from "@/components/kids/KidsRoomOccupancy";
import { KidsAbsentAlert } from "@/components/kids/KidsAbsentAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilialId } from "@/hooks/useFilialId";

interface Sala {
  id: string;
  nome: string;
  idade_min: number | null;
  idade_max: number | null;
  capacidade: number;
}

export default function Kids() {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSala, setSelectedSala] = useState<string>("all");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  
  // Stats
  const [totalCheckinsToday, setTotalCheckinsToday] = useState(0);
  const [activeSalasCount, setActiveSalasCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [igrejaId, filialId, isAllFiliais]);

  const fetchData = async () => {
    try {
      // Fetch salas (kids type only)
      let salasQuery = supabase
        .from("salas")
        .select("id, nome, idade_min, idade_max, capacidade")
        .eq("tipo", "kids")
        .eq("ativo", true);
      
      if (igrejaId) salasQuery = salasQuery.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) salasQuery = salasQuery.eq("filial_id", filialId);
      
      const { data: salasData } = await salasQuery;

      setSalas(salasData || []);

      // Count today's checkins
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: checkinsCount } = await supabase
        .from("presencas_aula")
        .select("*", { count: "exact", head: true })
        .gte("checkin_at", today.toISOString());

      setTotalCheckinsToday(checkinsCount || 0);

      // Count active salas (salas with at least 1 child checked in)
      const { data: occupancyData } = await supabase
        .from("view_room_occupancy")
        .select("sala_id, current_count");

      const activeCount = occupancyData?.filter(r => r.current_count > 0).length || 0;
      setActiveSalasCount(activeCount);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFaixaEtaria = (sala: Sala) => {
    if (sala.idade_min !== null && sala.idade_max !== null) {
      return `${sala.idade_min}-${sala.idade_max} anos`;
    }
    if (sala.idade_min !== null) {
      return `${sala.idade_min}+ anos`;
    }
    if (sala.idade_max !== null) {
      return `até ${sala.idade_max} anos`;
    }
    return "Todas as idades";
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Kids</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gerenciamento de crianças e salas</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastrar Criança</span>
              <span className="sm:hidden">Cadastrar</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Criança</DialogTitle>
              <DialogDescription>
                Preencha os dados da criança para cadastro no Kids
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4 p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input id="nome" placeholder="Nome da criança" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                  <Input id="dataNascimento" type="date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sala">Sala *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {salas.map((sala) => (
                      <SelectItem key={sala.id} value={sala.id}>
                        {sala.nome} ({getFaixaEtaria(sala)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsavel">Nome do Responsável *</Label>
                  <Input id="responsavel" placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone do Responsável *</Label>
                  <Input id="telefone" placeholder="(00) 00000-0000" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Médicas/Alergias</Label>
                <Textarea 
                  id="observacoes" 
                  placeholder="Alergias, medicamentos, restrições alimentares, etc."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas das Salas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Crianças Hoje</CardTitle>
            <Baby className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalCheckinsToday}</div>
                <p className="text-xs text-muted-foreground">
                  Check-ins realizados hoje
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeSalasCount}</div>
                <p className="text-xs text-muted-foreground">
                  Com pelo menos 1 criança
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Salas</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{salas.length}</div>
                <p className="text-xs text-muted-foreground">
                  Salas cadastradas
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ocupação e Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KidsRoomOccupancy />
        <KidsAbsentAlert />
      </div>

      {/* Salas Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Salas Disponíveis</CardTitle>
          <CardDescription>Distribuição por faixa etária</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : salas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma sala cadastrada. Acesse Ensino → Configurações para criar salas.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {salas.map((sala) => (
                <Card key={sala.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{sala.nome}</CardTitle>
                    <CardDescription>{getFaixaEtaria(sala)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capacidade:</span>
                      <span className="font-medium">{sala.capacidade}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
