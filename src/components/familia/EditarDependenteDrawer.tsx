import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle, HeartHandshake, Camera } from "lucide-react";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/perfil/AvatarUpload";

interface FamilyMember {
  id: string;
  nome: string;
  data_nascimento: string | null;
  avatar_url: string | null;
  alergias: string | null;
  necessidades_especiais: string | null;
  sexo: string | null;
  responsavel_legal: boolean | null;
}

interface EditarDependenteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  member: FamilyMember;
}

export default function EditarDependenteDrawer({
  open,
  onOpenChange,
  onSuccess,
  member,
}: EditarDependenteDrawerProps) {
  const queryClient = useQueryClient();
  const [alergias, setAlergias] = useState(member.alergias || "");
  const [necessidadesEspeciais, setNecessidadesEspeciais] = useState(member.necessidades_especiais || "");

  useEffect(() => {
    setAlergias(member.alergias || "");
    setNecessidadesEspeciais(member.necessidades_especiais || "");
  }, [member]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          alergias: alergias.trim() || null,
          necessidades_especiais: necessidadesEspeciais.trim() || null,
        })
        .eq('id', member.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso!");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao atualizar dados");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const handleAvatarUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['family-members'] });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Editar Dependente</DrawerTitle>
            <DrawerDescription>
              Atualize as informações de {member.nome}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <AvatarUpload
                userId={member.id}
                currentAvatarUrl={member.avatar_url}
                userName={member.nome}
                onAvatarUpdated={handleAvatarUpdated}
              />
              <div className="text-center">
                <h3 className="font-semibold text-lg">{member.nome}</h3>
                {member.data_nascimento && (
                  <p className="text-sm text-muted-foreground">
                    Nascido em {new Date(member.data_nascimento).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            {/* Alergias Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alergias" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Alergias / Restrições
                </Label>
                <Textarea
                  id="alergias"
                  value={alergias}
                  onChange={(e) => setAlergias(e.target.value)}
                  placeholder="Ex: Alergia a amendoim, lactose..."
                  className="border-destructive/50 focus-visible:ring-destructive/50"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Estas informações aparecerão na etiqueta de segurança do Kids
                </p>
              </div>

              {/* Necessidades Especiais */}
              <div className="space-y-2">
                <Label htmlFor="necessidades" className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-blue-600" />
                  Necessidades Especiais (Inclusão)
                </Label>
                <Textarea
                  id="necessidades"
                  value={necessidadesEspeciais}
                  onChange={(e) => setNecessidadesEspeciais(e.target.value)}
                  placeholder="Ex: Deficiência visual, TDAH, transtorno do espectro autista..."
                  className="border-blue-200 focus-visible:ring-blue-500"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Informações para garantir inclusão e acessibilidade adequada
                </p>
              </div>
            </form>
          </div>

          <DrawerFooter className="pt-6">
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Fechar
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
