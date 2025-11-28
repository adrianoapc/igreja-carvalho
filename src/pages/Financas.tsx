import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function Financas() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finanças</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie entradas e saídas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            <TrendingDown className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Saída</span>
            <span className="sm:hidden">Saída</span>
          </Button>
          <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Entrada</span>
            <span className="sm:hidden">Entrada</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total em Caixa
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">R$ 45.231,90</div>
            <p className="text-xs text-muted-foreground mt-1">Saldo atual</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Entradas do Mês
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-700 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">R$ 12.450,00</div>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">+15% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Saídas do Mês
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-700 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">R$ 8.320,50</div>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">-5% vs mês anterior</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Contas Contábeis</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm md:text-base text-muted-foreground">
            Sistema de contas contábeis será implementado em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
