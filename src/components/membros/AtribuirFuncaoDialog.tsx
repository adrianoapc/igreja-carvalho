import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface Funcao {
  id: string;
  nome: string;
  descricao: string | null;
}

interface AtribuirFuncaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membroId: string;
  membroNome: string;
  onSuccess: () => void;
}

export function AtribuirFuncaoDialog({
  open,
  onOpenChange,
  membroId,
  membroNome,
  onSuccess,
}: AtribuirFuncaoDialogProps) {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [selectedFuncao, setSelectedFuncao] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchFuncoes = async () => {
      try {
        const { data, error } = await supabase
          .from("funcoes_igreja")
          .select("*")
          .eq("ativo", true)
          .order("nome");

        if (error) throw error;
        setFuncoes(data || []);
      } catch (error) {
        console.error("Erro ao buscar funções:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as funções",
          variant: "destructive",
        });
      }
    };

    if (open) {
      fetchFuncoes();
    }
  }, [open, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFuncao) {
      toast({
        title: "Atenção",
        description: "Selecione uma função",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("membro_funcoes").insert({
        membro_id: membroId,
        funcao_id: selectedFuncao,
        data_inicio: dataInicio,
        ativo: true,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Função atribuída com sucesso",
      });

      onSuccess();
      onOpenChange(false);
      setSelectedFuncao("");
    } catch (error: unknown) {
      console.error("Erro ao atribuir função:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error) || "Não foi possível atribuir a função",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Atribuir Função"
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <p className="text-sm text-muted-foreground mb-4">
            Atribuir função para: <strong>{membroNome}</strong>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Select value={selectedFuncao} onValueChange={setSelectedFuncao}>
                <SelectTrigger id="funcao">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {funcoes.map((funcao) => (
                    <SelectItem key={funcao.id} value={funcao.id}>
                      {funcao.nome}
                      {funcao.descricao && (
                        <span className="text-xs text-muted-foreground ml-2">
                          - {funcao.descricao}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data de Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atribuir
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
