import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";

export default function Saidas() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Saídas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie os pagamentos da igreja</p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Saída
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Lista de Saídas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm md:text-base text-muted-foreground">
            Nenhuma saída cadastrada ainda.
          </p>
        </CardContent>
      </Card>

      <TransacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo="saida"
      />
    </div>
  );
}
