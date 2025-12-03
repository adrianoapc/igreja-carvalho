import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Camera,
  UserPlus,
  HeartHandshake,
  MessageCircle,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle,
  X
} from "lucide-react";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import AtencaoPastoralWidget from "@/components/dashboard/AtencaoPastoralWidget";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface Banner {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface FinancialStats {
  entradas: number;
  saidas: number;
  saldo: number;
  entradasVariacao: number;
  saidasVariacao: number;
}

interface PedidoOracao {
  id: string;
  pedido: string;
  nome_solicitante: string | null;
  pessoa: { nome: string; avatar_url: string | null } | null;
  created_at: string | null;
}

interface Testemunho {
  id: string;
  titulo: string;
  nome_externo: string | null;
  pessoa: { nome: string; avatar_url: string | null } | null;
  created_at: string;
}

interface ConsolidationData {
  name: string;
  value: number;
  color: string;
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
    entradasVariacao: 0,
    saidasVariacao: 0
  });
  const [cashFlowData, setCashFlowData] = useState<{ mes: string; entradas: number; saidas: number }[]>([]);
  const [consolidationData, setConsolidationData] = useState<ConsolidationData[]>([]);
  const [pedidosOracao, setPedidosOracao] = useState<PedidoOracao[]>([]);
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('sentimento') === 'true') {
      setSentimentoDialogOpen(true);
      searchParams.delete('sentimento');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchBanners();
    fetchFinancialData();
    fetchConsolidationData();
    fetchPedidosOracao();
    fetchTestemunhos();
  }, []);

  const fetchBanners = async () => {
    const { data } = await supabase
      .from('banners')
      .select('id, title, message, type')
      .eq('active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) setBanners(data);
  };

  const fetchFinancialData = async () => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Current month transactions
    const { data: currentData } = await supabase
      .from('transacoes_financeiras')
      .select('tipo, valor, categoria:categorias_financeiras(nome)')
      .gte('data_transacao', currentMonthStart.toISOString())
      .lte('data_transacao', currentMonthEnd.toISOString())
      .eq('status', 'pago');

    // Last month transactions
    const { data: lastMonthData } = await supabase
      .from('transacoes_financeiras')
      .select('tipo, valor')
      .gte('data_transacao', lastMonthStart.toISOString())
      .lte('data_transacao', lastMonthEnd.toISOString())
      .eq('status', 'pago');

    if (currentData) {
      const entradas = currentData.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
      const saidas = currentData.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);

      const lastEntradas = lastMonthData?.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0) || 0;
      const lastSaidas = lastMonthData?.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0) || 0;

      const entradasVariacao = lastEntradas > 0 ? ((entradas - lastEntradas) / lastEntradas) * 100 : 0;
      const saidasVariacao = lastSaidas > 0 ? ((saidas - lastSaidas) / lastSaidas) * 100 : 0;

      setFinancialStats({
        entradas,
        saidas,
        saldo: entradas - saidas,
        entradasVariacao,
        saidasVariacao
      });
    }

    // Cash flow data (last 6 months)
    const cashFlow: { mes: string; entradas: number; saidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const { data: monthData } = await supabase
        .from('transacoes_financeiras')
        .select('tipo, valor')
        .gte('data_transacao', monthStart.toISOString())
        .lte('data_transacao', monthEnd.toISOString())
        .eq('status', 'pago');

      const monthEntradas = monthData?.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0) || 0;
      const monthSaidas = monthData?.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0) || 0;

      cashFlow.push({
        mes: format(monthDate, 'MMM', { locale: ptBR }),
        entradas: monthEntradas,
        saidas: monthSaidas
      });
    }
    setCashFlowData(cashFlow);
  };

  const fetchConsolidationData = async () => {
    const { data: visitors } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'visitante');

    const { data: frequenters } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'frequentador');

    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'membro');

    setConsolidationData([
      { name: 'Visitantes', value: visitors?.length || 0, color: 'hsl(var(--chart-1))' },
      { name: 'Frequentadores', value: frequenters?.length || 0, color: 'hsl(var(--chart-2))' },
      { name: 'Membros', value: members?.length || 0, color: 'hsl(var(--chart-3))' }
    ]);
  };

  const fetchPedidosOracao = async () => {
    const { data } = await supabase
      .from('pedidos_oracao')
      .select(`
        id,
        pedido,
        nome_solicitante,
        created_at
      `)
      .in('status', ['pendente', 'em_oracao'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      // Fetch pessoa data separately for each pedido that has pessoa_id
      const pedidosWithPessoa = await Promise.all(
        data.map(async (pedido) => {
          return {
            ...pedido,
            pessoa: null as { nome: string; avatar_url: string | null } | null
          };
        })
      );
      setPedidosOracao(pedidosWithPessoa);
    }
  };

  const fetchTestemunhos = async () => {
    const { data } = await supabase
      .from('testemunhos')
      .select(`
        id,
        titulo,
        nome_externo,
        created_at
      `)
      .eq('status', 'publico')
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      const testemunhosWithPessoa = data.map((t) => ({
        ...t,
        pessoa: null as { nome: string; avatar_url: string | null } | null
      }));
      setTestemunhos(testemunhosWithPessoa);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  };

  const getBannerVariant = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200';
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200';
      case 'urgent': return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200';
      default: return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200';
    }
  };

  const getBannerIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle;
      case 'urgent': return AlertTriangle;
      default: return Info;
    }
  };

  const dismissBanner = (id: string) => {
    setDismissedBanners(prev => [...prev, id]);
  };

  const activeBanners = banners.filter(b => !dismissedBanners.includes(b.id));
  const firstName = profile?.nome?.split(' ')[0] || 'Usuário';

  const chartConfig = {
    entradas: { label: "Entradas", color: "hsl(var(--chart-1))" },
    saidas: { label: "Saídas", color: "hsl(var(--chart-2))" },
  };

  return (
    <div className="space-y-6">
      {/* Header & Personal Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Olá, {firstName}!
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Button 
          onClick={() => setSentimentoDialogOpen(true)} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          <span>Como você está?</span>
        </Button>
      </div>

      <RegistrarSentimentoDialog open={sentimentoDialogOpen} onOpenChange={setSentimentoDialogOpen} />

      {/* Alerts/Banners Area */}
      {activeBanners.length > 0 && (
        <div className="space-y-2">
          {activeBanners.map(banner => {
            const Icon = getBannerIcon(banner.type);
            return (
              <Alert key={banner.id} className={`${getBannerVariant(banner.type)} relative`}>
                <Icon className="h-4 w-4" />
                <AlertTitle className="font-semibold">{banner.title}</AlertTitle>
                <AlertDescription className="text-sm opacity-90">{banner.message}</AlertDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-70 hover:opacity-100"
                  onClick={() => dismissBanner(banner.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Quick Actions Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/financas/saidas?nova=true')}
          className="gap-2"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Lançar Nota</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/pessoas/visitantes?novo=true')}
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Visitante</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/intercessao/pedidos?novo=true')}
          className="gap-2"
        >
          <HeartHandshake className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Pedido</span>
        </Button>
      </div>

      {/* Section: Financial Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Financeiro
          </h2>
          <Badge variant="secondary" className="text-xs">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </Badge>
        </div>
        
        {/* Financial KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="text-lg md:text-xl font-bold text-emerald-600">{formatCurrency(financialStats.entradas)}</p>
                </div>
                <div className={`flex items-center text-xs ${financialStats.entradasVariacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {financialStats.entradasVariacao >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(financialStats.entradasVariacao).toFixed(0)}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="text-lg md:text-xl font-bold text-red-600">{formatCurrency(financialStats.saidas)}</p>
                </div>
                <div className={`flex items-center text-xs ${financialStats.saidasVariacao <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {financialStats.saidasVariacao <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {Math.abs(financialStats.saidasVariacao).toFixed(0)}%
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div>
                <p className="text-xs text-muted-foreground">Saldo do Mês</p>
                <p className={`text-lg md:text-xl font-bold ${financialStats.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(financialStats.saldo)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section: Strategic Vision (Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash Flow Chart */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Fluxo de Caixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Bar dataKey="entradas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Consolidation Funnel */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Funil de Consolidação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={consolidationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {consolidationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section: Pastoral (Heart of the Church) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          Vida da Igreja
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Prayer Requests */}
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                Pedidos de Oração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pedidosOracao.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido pendente</p>
              ) : (
                pedidosOracao.map(pedido => (
                  <div key={pedido.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={pedido.pessoa?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(pedido.pessoa?.nome || pedido.nome_solicitante || 'Anônimo')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {pedido.pessoa?.nome || pedido.nome_solicitante || 'Anônimo'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{pedido.pedido}</p>
                    </div>
                  </div>
                ))
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => navigate('/intercessao/pedidos')}
              >
                Ver todos
              </Button>
            </CardContent>
          </Card>

          {/* Testimonies */}
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Testemunhos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testemunhos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum testemunho recente</p>
              ) : (
                testemunhos.map(testemunho => (
                  <div key={testemunho.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={testemunho.pessoa?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(testemunho.pessoa?.nome || testemunho.nome_externo || 'Anônimo')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {testemunho.pessoa?.nome || testemunho.nome_externo || 'Anônimo'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{testemunho.titulo}</p>
                    </div>
                  </div>
                ))
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => navigate('/intercessao/testemunhos')}
              >
                Ver todos
              </Button>
            </CardContent>
          </Card>

          {/* Sheep Monitoring Widget */}
          <AtencaoPastoralWidget />
        </div>
      </div>
    </div>
  );
}
