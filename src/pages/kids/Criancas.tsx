import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KidCard } from "@/components/kids/KidCard";
import { Search, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInYears } from "date-fns";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface Kid {
  id: string;
  nome: string;
  data_nascimento?: string;
  avatar_url?: string;
  alergias?: string;
  necessidades_especiais?: string;
  responsaveis?: {
    id: string;
    nome: string;
    telefone?: string;
    parentesco: string;
  }[];
}

export default function Criancas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [ageFilter, setAgeFilter] = useState<string>("todas");
  const [inclusaoFilter, setInclusaoFilter] = useState<string>("todas");
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  // Query para buscar crianças com responsáveis
  const { data: kids = [], isLoading } = useQuery({
    queryKey: ["kids-directory", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const today = new Date();

      // Buscar todos os perfis com data_nascimento (crianças menores de 13 anos)
      let profilesQuery = supabase
        .from("profiles")
        .select("id, nome, data_nascimento, avatar_url, alergias, necessidades_especiais, familia_id")
        .not("data_nascimento", "is", null)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        profilesQuery = profilesQuery.eq("filial_id", filialId);
      }
      const response = await profilesQuery;

      const { data: allProfiles, error: profilesError } = response as { data: unknown[]; error: unknown };

      if (profilesError) throw profilesError;

      // Filtrar apenas crianças (menores de 13 anos)
      const profiles = (allProfiles || []).filter((p: { data_nascimento?: string | null; status?: string }) => {
        if (!p.data_nascimento) return false;
        const birthDate = new Date(p.data_nascimento);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
          ? age - 1 
          : age;
        return actualAge < 13;
      });

      console.log(`[Kids Directory] Encontradas ${profiles.length} crianças de ${allProfiles.length} perfis`);

      // Para cada criança, buscar seus responsáveis
      const kidsWithResponsaveis = await Promise.all(
        (profiles || []).map(async (kid: { id: string }) => {
          // Query bidirecional: busca os dois lados da relação
          let relationshipsAsPessoaQuery = supabase
            .from('familias')
            .select('id, pessoa_id, familiar_id, tipo_parentesco')
            .eq('pessoa_id', kid.id)
            .eq('igreja_id', igrejaId);
          let relationshipsAsFamiliarQuery = supabase
            .from('familias')
            .select('id, pessoa_id, familiar_id, tipo_parentesco')
            .eq('familiar_id', kid.id)
            .eq('igreja_id', igrejaId);
          if (!isAllFiliais && filialId) {
            relationshipsAsPessoaQuery = relationshipsAsPessoaQuery.eq('filial_id', filialId);
            relationshipsAsFamiliarQuery = relationshipsAsFamiliarQuery.eq('filial_id', filialId);
          }
          const [relationshipsAsPessoa, relationshipsAsFamiliar] = await Promise.all([
            relationshipsAsPessoaQuery,
            relationshipsAsFamiliarQuery,
          ]);

          // Combinar ambas as queries
          const relationships = [
            ...(relationshipsAsPessoa.data || []),
            ...(relationshipsAsFamiliar.data || [])
          ];

          if (relationships.length === 0) {
            return { ...kid, responsaveis: [] };
          }

          // Identificar os responsáveis (o "alvo" da relação)
          const responsavelIds = new Set<string>();
          const responsavelMap = new Map<string, string>(); // id -> tipo_parentesco

          relationships.forEach((item: { pessoa_id: string; familiar_id: string; tipo_parentesco: string }) => {
            let targetId: string;

            // Se a criança é "pessoa_id", o responsável é "familiar_id"
            // Se a criança é "familiar_id", o responsável é "pessoa_id"
            if (item.pessoa_id === kid.id) {
              targetId = item.familiar_id;
            } else {
              targetId = item.pessoa_id;
            }

            if (targetId) {
              responsavelIds.add(targetId);
              if (!responsavelMap.has(targetId)) {
                responsavelMap.set(targetId, item.tipo_parentesco);
              }
            }
          });

          if (responsavelIds.size === 0) {
            return { ...kid, responsaveis: [] };
          }

          // Buscar dados dos responsáveis
          let responsavelProfilesQuery = supabase
            .from('profiles')
            .select('id, nome, telefone, data_nascimento')
            .in('id', Array.from(responsavelIds))
            .eq('igreja_id', igrejaId);
          if (!isAllFiliais && filialId) {
            responsavelProfilesQuery = responsavelProfilesQuery.eq('filial_id', filialId);
          }
          const { data: responsavelProfiles } = await responsavelProfilesQuery;

          // Filtrar apenas responsáveis maiores de 18 anos
          const responsaveis = (responsavelProfiles || [])
            .filter(resp => {
              if (!resp.data_nascimento) return false;
              
              // Garantir que data_nascimento é uma data válida
              const birthDate = new Date(resp.data_nascimento);
              
              // Verificar se a data é válida
              if (isNaN(birthDate.getTime())) {
                console.warn(`Data de nascimento inválida para ${resp.nome}:`, resp.data_nascimento);
                return false;
              }
              
              const age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
                ? age - 1
                : age;

              console.log(`[Kids Directory] ${resp.nome} tem ${actualAge} anos (data: ${resp.data_nascimento}) - ${actualAge >= 18 ? 'RESPONSÁVEL' : 'filtrado'}`);
              return actualAge >= 18;
            })
            .map(resp => ({
              id: resp.id,
              nome: resp.nome,
              telefone: resp.telefone || undefined,
              parentesco: responsavelMap.get(resp.id) || 'Responsável'
            }));

          return {
            ...kid,
            responsaveis
          };
        })
      );

      return kidsWithResponsaveis as Kid[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Filtros
  const filteredKids = useMemo(() => {
    let result = kids;

    // Filtro por nome
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((kid) =>
        kid.nome.toLowerCase().includes(term)
      );
    }

    // Filtro por idade
    if (ageFilter !== "todas") {
      result = result.filter((kid) => {
        if (!kid.data_nascimento) return false;
        const age = differenceInYears(new Date(), new Date(kid.data_nascimento));

        switch (ageFilter) {
          case "0-2":
            return age >= 0 && age <= 2;
          case "3-5":
            return age >= 3 && age <= 5;
          case "6+":
            return age >= 6;
          default:
            return true;
        }
      });
    }

    // Filtro por necessidades especiais (inclusão)
    if (inclusaoFilter !== "todas") {
      result = result.filter((kid) => {
        if (inclusaoFilter === "com") {
          return kid.necessidades_especiais && kid.necessidades_especiais.trim().length > 0;
        } else if (inclusaoFilter === "sem") {
          return !kid.necessidades_especiais || kid.necessidades_especiais.trim().length === 0;
        }
        return true;
      });
    }

    return result;
  }, [kids, searchTerm, ageFilter, inclusaoFilter]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Crianças Cadastradas
            </h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? (
                "Carregando..."
              ) : (
                <>
                  {filteredKids.length} {filteredKids.length === 1 ? "criança" : "crianças"}
                  {kids.length !== filteredKids.length && ` de ${kids.length} total`}
                </>
              )}
            </p>
          </div>
          <Button asChild size="default" className="gap-2">
            <Link to="/cadastro/pessoa?tipo=dependente">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Criança</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Barra de Ferramentas */}
      <div className="flex flex-col sm:flex-row gap-3 bg-muted/30 p-4 rounded-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <Select value={ageFilter} onValueChange={setAgeFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-background">
            <SelectValue placeholder="Filtrar por idade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as idades</SelectItem>
            <SelectItem value="0-2">0-2 anos</SelectItem>
            <SelectItem value="3-5">3-5 anos</SelectItem>
            <SelectItem value="6+">6+ anos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={inclusaoFilter} onValueChange={setInclusaoFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Filtrar por inclusão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as crianças</SelectItem>
            <SelectItem value="com">Com necessidades especiais</SelectItem>
            <SelectItem value="sem">Sem necessidades especiais</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : filteredKids.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-lg">
            {searchTerm || ageFilter !== "todas"
              ? "Nenhuma criança encontrada com os filtros aplicados"
              : "Nenhuma criança cadastrada ainda"}
          </p>
          {!searchTerm && ageFilter === "todas" && (
            <Button asChild className="mt-4" variant="outline">
              <Link to="/cadastro/pessoa?tipo=dependente">
                Cadastrar primeira criança
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKids.map((kid) => (
            <KidCard
              key={kid.id}
              id={kid.id}
              nome={kid.nome}
              data_nascimento={kid.data_nascimento}
              avatar_url={kid.avatar_url}
              alergias={kid.alergias}
              necessidades_especiais={kid.necessidades_especiais}
              responsaveis={kid.responsaveis}
            />
          ))}
        </div>
      )}
    </div>
  );
}
