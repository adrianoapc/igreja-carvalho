import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function Fornecedores() {
  const navigate = useNavigate();

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Cadastro de fornecedores e beneficiários</p>
          </div>
          <Button className="bg-gradient-primary shadow-soft">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Fornecedor</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando fornecedores...</p>
          </CardContent>
        </Card>
      ) : fornecedores && fornecedores.length > 0 ? (
        <div className="space-y-3">
          {fornecedores.map((fornecedor) => (
            <Card key={fornecedor.id} className="shadow-soft hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {fornecedor.tipo_pessoa === 'juridica' ? (
                      <Building className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base md:text-lg font-semibold text-foreground">
                        {fornecedor.nome}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {fornecedor.tipo_pessoa === 'juridica' ? 'PJ' : 'PF'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {fornecedor.cpf_cnpj && (
                        <p>{fornecedor.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'}: {fornecedor.cpf_cnpj}</p>
                      )}
                      {fornecedor.email && <p>Email: {fornecedor.email}</p>}
                      {fornecedor.telefone && <p>Telefone: {fornecedor.telefone}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhum fornecedor cadastrado ainda.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
