import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RegistrarVisitanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegistrarVisitanteDialog({ open, onOpenChange, onSuccess }: RegistrarVisitanteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    aceitou_jesus: false,
    deseja_contato: true,
    recebeu_brinde: false,
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Erro",
        description: "Informe pelo menos um contato (telefone ou email)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .insert({
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || null,
          email: formData.email.trim() || null,
          aceitou_jesus: formData.aceitou_jesus,
          deseja_contato: formData.deseja_contato,
          recebeu_brinde: formData.recebeu_brinde,
          status: "visitante",
          data_primeira_visita: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Visitante registrado com sucesso"
      });

      setFormData({
        nome: "",
        telefone: "",
        email: "",
        aceitou_jesus: false,
        deseja_contato: true,
        recebeu_brinde: false,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar visitante:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o visitante",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Visitante</DialogTitle>
          <DialogDescription>
            Preencha os dados do visitante
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome completo"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(11) 98765-4321"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aceitou_jesus"
                checked={formData.aceitou_jesus}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, aceitou_jesus: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="aceitou_jesus"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Aceitou Jesus
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="deseja_contato"
                checked={formData.deseja_contato}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, deseja_contato: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="deseja_contato"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Deseja receber contato
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recebeu_brinde"
                checked={formData.recebeu_brinde}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, recebeu_brinde: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="recebeu_brinde"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recebeu brinde
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
