import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, LayoutDashboard, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Jornada {
  id: string;
  titulo: string;
  descricao: string | null;
  cor_tema: string | null;
  ativo: boolean | null;
  exibir_portal: boolean | null;
}

interface EtapaJornada {
  id: string;
  titulo: string;
  ordem: number | null;
}

interface PessoaResumo {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface RawInscricao {
  id: string;
  pessoa_id: string;
  etapa_atual_id: string | null;
  concluido: boolean;
  pessoa: PessoaResumo | null;
  responsavel: PessoaResumo | null;
}

interface PresencaEtapa {
  aluno_id: string | null;
  etapa_id: string | null;
  status: string | null;
}

interface InscricaoComProgresso {
  id: string;
  pessoa_id: string;
  etapa_atual_id: string | null;
  concluido: boolean;
  pessoa: PessoaResumo | null;
  responsavel: PessoaResumo | null;
  etapasConcluidas: number;
}

export default function DetalhesJornada() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [etapas, setEtapas] = useState<EtapaJornada[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoComProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [matriculaOpen, setMatriculaOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PessoaResumo[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalEtapas = useMemo(() => etapas.length, [etapas]);
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [jornadaRes, etapasRes] = await Promise.all([
        supabase
          .from("jornadas")
          .select("id, titulo, descricao, cor_tema, ativo, exibir_portal")
          .eq("id", id)
          .single(),
        supabase
          .from("etapas_jornada")
          .select("id, titulo, ordem")
          .eq("jornada_id", id)
          .order("ordem", { ascending: true }),
      ]);

      if (jornadaRes.error) throw jornadaRes.error;
      if (etapasRes.error) throw etapasRes.error;

      setJornada(jornadaRes.data as Jornada);
      setEtapas((etapasRes.data as EtapaJornada[]) || []);

      const { data: inscricoesData, error: inscricoesError } = await supabase
        .from("inscricoes_jornada")
        .select<RawInscricao[]>(`
          id,
          pessoa_id,
          etapa_atual_id,
          concluido,
          pessoa:profiles!inscricoes_jornada_pessoa_id_fkey(id, nome, avatar_url),
          responsavel:profiles!inscricoes_jornada_responsavel_id_fkey(id, nome, avatar_url)
        `)
        .eq("jornada_id", id);

      if (inscricoesError) throw inscricoesError;

      const etapaIds = (etapasRes.data || []).map((e) => e.id);
      let concluidoPorAluno: Record<string, number> = {};

      if (etapaIds.length > 0) {
        const { data: presencas, error: presencasError } = await supabase
          .from("presencas_aula")
          .select<PresencaEtapa[]>("aluno_id, etapa_id, status")
          .eq("status", "concluido")
          .in("etapa_id", etapaIds);

        if (presencasError) throw presencasError;

        concluidoPorAluno = (presencas || []).reduce((acc, presenca) => {
          if (!presenca.aluno_id) return acc;
          acc[presenca.aluno_id] = (acc[presenca.aluno_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      const inscricoesComProgresso: InscricaoComProgresso[] = (inscricoesData || []).map(
        (inscricao) => ({
          ...inscricao,
          etapasConcluidas: concluidoPorAluno[inscricao.pessoa_id] || 0,
        })
      );

      setInscricoes(inscricoesComProgresso);
    } catch (error) {
      console.error("Erro ao carregar jornada:", error);
      toast.error("Não foi possível carregar os dados da jornada");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .ilike("nome", `%${term}%`)
        .order("nome")
        .limit(10);

      if (error) throw error;

      const inscritosIds = new Set(inscricoes.map((i) => i.pessoa_id));
      const filtrados = (data || []).filter((pessoa) => !inscritosIds.has(pessoa.id));
      setSearchResults(filtrados as PessoaResumo[]);
    } catch (error) {
      console.error("Erro na busca de pessoas:", error);
      toast.error("Não foi possível buscar pessoas");
    } finally {
      setSearching(false);
    }
  };

  const handleMatricular = async (pessoaId: string) => {
    if (!id) return;
    setSaving(true);

    try {
      const { error } = await supabase.from("inscricoes_jornada").insert({
        jornada_id: id,
        pessoa_id: pessoaId,
        responsavel_id: profile?.id || null,
      });

      if (error) throw error;

      toast.success("Aluno matriculado com sucesso");
      setMatriculaOpen(false);
      setSearchTerm("");
      setSearchResults([]);
      await loadData();
    } catch (error) {
      const isDuplicate = (error as { code?: string } | null)?.code === "23505";
      if (isDuplicate) {
        toast.error("Este aluno já está matriculado");
      } else {
        toast.error("Não foi possível matricular o aluno");
      }
      console.error("Erro ao matricular:", error);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (nome?: string | null) => {
    if (!nome) return "?";
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!jornada) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-muted-foreground">Jornada não encontrada.</p>
            <Button variant="link" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/jornadas")}> 
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{jornada.titulo}</h1>
            <p className="text-sm text-muted-foreground">Gestão de alunos e progresso</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/jornadas/${id}/board`} className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Ver board
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
         <Card className="md:col-span-2">
           <CardHeader>
             <CardTitle>Resumo</CardTitle>
             <CardDescription>{jornada.descricao}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex flex-wrap items-center gap-2">
               <Badge variant="secondary">{jornada.ativo ? "Ativa" : "Inativa"}</Badge>
               {jornada.exibir_portal && <Badge variant="outline">Visível no portal</Badge>}
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="p-4 rounded-lg border bg-muted/30">
                 <p className="text-sm text-muted-foreground">Total de etapas</p>
                 <p className="text-2xl font-semibold">{totalEtapas}</p>
               </div>
               <div className="p-4 rounded-lg border bg-muted/30">
                 <p className="text-sm text-muted-foreground">Alunos ativos</p>
                 <p className="text-2xl font-semibold">{inscricoes.length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle>Etapas</CardTitle>
             <CardDescription>Ordem da jornada</CardDescription>
           </CardHeader>
           <CardContent className="space-y-3">
             {etapas.length === 0 ? (
               <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
             ) : (
               etapas.map((etapa) => (
                 <div key={etapa.id} className="flex items-center justify-between rounded-lg border p-3">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-medium">
                       {etapa.ordem || 0}
                     </div>
                     <div>
                       <p className="font-medium leading-tight">{etapa.titulo}</p>
                     </div>
                   </div>
                   <Badge variant="secondary">Etapa</Badge>
                 </div>
               ))
             )}
           </CardContent>
         </Card>
       </div>
 
       <Card>
         <CardHeader className="flex flex-row items-center justify-between gap-4">
           <div>
             <CardTitle>Alunos</CardTitle>
             <CardDescription>Progresso por etapa</CardDescription>
           </div>
           <Button onClick={() => setMatriculaOpen(true)} size="sm">
             <UserPlus className="h-4 w-4 mr-2" />
             Matricular aluno
           </Button>
         </CardHeader>
         <CardContent className="space-y-3">
           {inscricoes.length === 0 ? (
             <div className="text-center text-sm text-muted-foreground py-8">
               Nenhum aluno matriculado nesta jornada.
             </div>
           ) : (
             inscricoes.map((inscricao) => {
               const progresso = totalEtapas === 0 ? 0 : Math.round((inscricao.etapasConcluidas / totalEtapas) * 100);
               const aluno = inscricao.pessoa;
 
               return (
                 <div
                   key={inscricao.id}
                   className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                 >
                   <div className="flex items-center gap-3 min-w-0">
                     <Avatar>
                       <AvatarImage src={aluno?.avatar_url || undefined} />
                       <AvatarFallback>{getInitials(aluno?.nome)}</AvatarFallback>
                     </Avatar>
                     <div className="min-w-0">
                       <p className="font-medium leading-tight truncate">{aluno?.nome || "Sem nome"}</p>
                       {inscricao.responsavel && (
                         <p className="text-xs text-muted-foreground truncate">
                           Responsável: {inscricao.responsavel.nome}
                         </p>
                       )}
                     </div>
                   </div>
 
                   <div className="flex-1 md:max-w-md w-full">
                     <div className="flex justify-between text-xs text-muted-foreground mb-1">
                       <span>{inscricao.etapasConcluidas}/{totalEtapas} etapas</span>
                       <span>{progresso}%</span>
                     </div>
                     <Progress value={progresso} className="h-2" />
                   </div>
                 </div>
               );
             })
           )}
         </CardContent>
       </Card>
 
       <Dialog open={matriculaOpen} onOpenChange={setMatriculaOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Matricular aluno</DialogTitle>
             <DialogDescription>Busque a pessoa e confirme a matrícula.</DialogDescription>
           </DialogHeader>
 
           <div className="space-y-3">
             <Input
               placeholder="Buscar por nome"
               value={searchTerm}
               onChange={(e) => handleSearch(e.target.value)}
             />
             <Separator />
             <div className="space-y-2 max-h-64 overflow-y-auto">
               {searchTerm && searchResults.length === 0 && !searching && (
                 <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
               )}
               {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}
               {searchResults.map((pessoa) => (
                 <div key={pessoa.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                   <div className="flex items-center gap-3">
                     <Avatar>
                       <AvatarImage src={pessoa.avatar_url || undefined} />
                       <AvatarFallback>{getInitials(pessoa.nome)}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-medium leading-tight">{pessoa.nome}</p>
                     </div>
                   </div>
                   <Button size="sm" onClick={() => handleMatricular(pessoa.id)} disabled={saving}>
                     {saving ? "Matriculando..." : "Matricular"}
                   </Button>
                 </div>
               ))}
             </div>
           </div>
 
           <DialogFooter>
             <Button variant="outline" onClick={() => setMatriculaOpen(false)}>
               Fechar
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }
