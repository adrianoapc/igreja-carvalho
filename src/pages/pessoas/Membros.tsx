import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Mail, Phone, Settings, UserPlus, ArrowLeft } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AtribuirFuncaoDialog } from "@/components/membros/AtribuirFuncaoDialog";
import { GerenciarFuncoesDialog } from "@/components/membros/GerenciarFuncoesDialog";
import { formatarTelefone } from "@/lib/validators";
interface Membro {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: string;
  avatar_url?: string | null;
  funcoes: Array<{
    id: string;
    nome: string;
  }>;
  times: Array<{
    id: string;
    nome: string;
    cor: string | null;
    posicao: string | null;
  }>;
}
const ITEMS_PER_PAGE = 10;
export default function Membros() {
  const [displayedMembros, setDisplayedMembros] = useState<Membro[]>([]);
  const [allMembros, setAllMembros] = useState<Membro[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [atribuirFuncaoOpen, setAtribuirFuncaoOpen] = useState(false);
  const [gerenciarFuncoesOpen, setGerenciarFuncoesOpen] = useState(false);
  const [selectedMembro, setSelectedMembro] = useState<Membro | null>(null);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const fetchMembros = async () => {
    try {
      // Buscar membros
      const {
        data: membrosData,
        error: membrosError
      } = await supabase.from("profiles").select("id, nome, email, telefone, status, avatar_url").eq("status", "membro").order("nome");
      if (membrosError) throw membrosError;

      // Buscar funções e times de cada membro
      const membrosComFuncoes = await Promise.all((membrosData || []).map(async membro => {
        // Buscar funções
        const {
          data: funcoesData
        } = await supabase.from("membro_funcoes").select(`
              id,
              funcoes_igreja (
                id,
                nome
              )
            `).eq("membro_id", membro.id).eq("ativo", true);
        
        // Buscar times e posições
        const {
          data: timesData
        } = await supabase.from("membros_time").select(`
              id,
              times_culto (
                id,
                nome,
                cor
              ),
              posicoes_time (
                id,
                nome
              )
            `).eq("pessoa_id", membro.id).eq("ativo", true);
        
        return {
          ...membro,
          funcoes: funcoesData?.map((f: any) => ({
            id: f.funcoes_igreja.id,
            nome: f.funcoes_igreja.nome
          })) || [],
          times: timesData?.map((t: any) => ({
            id: t.times_culto.id,
            nome: t.times_culto.nome,
            cor: t.times_culto.cor,
            posicao: t.posicoes_time?.nome || null
          })) || []
        };
      }));
      setAllMembros(membrosComFuncoes);
      setDisplayedMembros(membrosComFuncoes.slice(0, ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Erro ao buscar membros:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os membros",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    fetchMembros();
  }, []);
  const {
    loadMoreRef,
    isLoading,
    hasMore,
    page,
    setIsLoading,
    setHasMore,
    setPage
  } = useInfiniteScroll();

  // Load more when page changes and it's not the initial page
  useEffect(() => {
    if (page === 1 || allMembros.length === 0) return;
    
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const newItems = allMembros.slice(start, end);
    
    if (newItems.length > 0) {
      setDisplayedMembros(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
        return [...prev, ...uniqueNewItems];
      });
    }
    
    if (end >= allMembros.length) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [page, allMembros, setHasMore, setIsLoading]);
  const filteredMembros = displayedMembros.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || m.email?.toLowerCase().includes(searchTerm.toLowerCase()) || m.telefone?.includes(searchTerm));
  const handleAtribuirFuncao = (membro: Membro) => {
    setSelectedMembro(membro);
    setAtribuirFuncaoOpen(true);
  };
  return <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Membros
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie os membros da igreja
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGerenciarFuncoesOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Gerenciar Funções</span>
            <span className="sm:hidden">Funções</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar membros..." className="pl-10 text-sm md:text-base" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {filteredMembros.map((membro, index) => <div key={membro.id} ref={index === filteredMembros.length - 1 ? loadMoreRef : null} className="flex flex-col gap-3 p-3 md:p-4 rounded-lg transition-colors bg-[#eff0cf]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                      <AvatarImage src={membro.avatar_url || undefined} alt={membro.nome} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-base md:text-lg">
                        {membro.nome.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm md:text-base text-foreground truncate">
                        {membro.nome}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                        {membro.email && <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{membro.email}</span>
                          </span>}
                        {membro.telefone && <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground text-center">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {formatarTelefone(membro.telefone)}
                          </span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAtribuirFuncao(membro)} className="text-center">
                      <UserPlus className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Atribuir</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/pessoas/${membro.id}`)}>
                      Ver Perfil
                    </Button>
                  </div>
                </div>

                {(membro.funcoes.length > 0 || membro.times.length > 0) && <div className="flex flex-wrap gap-2 mt-2">
                    {membro.funcoes.map(funcao => <Badge key={`funcao-${funcao.id}`} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        {funcao.nome}
                      </Badge>)}
                    {membro.times.map(time => <Badge key={`time-${time.id}`} variant="outline" style={{ borderColor: time.cor || undefined }}>
                        {time.nome}
                        {time.posicao && <span className="ml-1 text-muted-foreground">• {time.posicao}</span>}
                      </Badge>)}
                  </div>}
              </div>)}

            {isLoading && <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-secondary">
                    <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>)}
              </div>}

            {!hasMore && displayedMembros.length > 0 && <div className="text-center py-4 text-sm text-muted-foreground">
                Todos os membros foram carregados
              </div>}

            {filteredMembros.length === 0 && !isLoading && <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum membro encontrado</p>
              </div>}
          </div>
        </CardContent>
      </Card>

      {selectedMembro && <AtribuirFuncaoDialog open={atribuirFuncaoOpen} onOpenChange={setAtribuirFuncaoOpen} membroId={selectedMembro.id} membroNome={selectedMembro.nome} onSuccess={fetchMembros} />}

      <GerenciarFuncoesDialog open={gerenciarFuncoesOpen} onOpenChange={setGerenciarFuncoesOpen} />
    </div>;
}