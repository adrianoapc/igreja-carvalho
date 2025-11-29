import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Fornecedores() {
  const navigate = useNavigate();

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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Cadastro de fornecedores e beneficiários</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Lista de Fornecedores</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm md:text-base text-muted-foreground">
            Nenhum fornecedor cadastrado ainda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
