import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building2, Landmark, Wallet, Edit, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ContaDialog } from "@/components/financas/ContaDialog";
import { AjusteSaldoDialog } from "@/components/financas/AjusteSaldoDialog";

export default function Contas() {
  const navigate = useNavigate();
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [ajusteSaldoDialogOpen, setAjusteSaldoDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);

  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return <Landmark className="w-5 h-5" />;
      case 'fisica': return <Wallet className="w-5 h-5" />;
      case 'virtual': return <Building2 className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return 'Bancária';
      case 'fisica': return 'Física';
      case 'virtual': return 'Virtual';
      default: return tipo;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financas')}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Contas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie contas bancárias e caixas</p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedConta(null);
              setContaDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Conta</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando contas...</p>
          </CardContent>
        </Card>
      ) : contas && contas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((conta) => (
            <Card key={conta.id} className="shadow-soft hover:shadow-md transition-shadow">
              <CardHeader className="p-4 md:p-6 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getTipoIcon(conta.tipo)}
                    <CardTitle className="text-base md:text-lg">{conta.nome}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {getTipoLabel(conta.tipo)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedConta(conta);
                        setAjusteSaldoDialogOpen(true);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedConta(conta);
                        setContaDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">
                      {formatCurrency(conta.saldo_atual)}
                    </p>
                  </div>
                  {conta.banco && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <p>{conta.banco}</p>
                      {conta.agencia && conta.conta_numero && (
                        <p>Ag: {conta.agencia} | CC: {conta.conta_numero}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhuma conta cadastrada ainda. Configure contas bancárias, caixas físicos ou virtuais.
            </p>
          </CardContent>
        </Card>
      )}

      <ContaDialog
        open={contaDialogOpen}
        onOpenChange={setContaDialogOpen}
        conta={selectedConta}
      />

      {selectedConta && (
        <AjusteSaldoDialog
          open={ajusteSaldoDialogOpen}
          onOpenChange={setAjusteSaldoDialogOpen}
          conta={selectedConta}
        />
      )}
    </div>
  );
}
