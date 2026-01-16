import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface IntegracaoCriarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  integracaoId?: string | null;
}

const PROVEDORES = ["santander", "getnet", "api_generico"] as const;

export function IntegracaoCriarDialog({
  open,
  onOpenChange,
  onSuccess,
  integracaoId,
}: IntegracaoCriarDialogProps) {
  const [provedor, setProvedor] = useState<string>("santander");
  const [cnpj, setCnpj] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const isEditMode = !!integracaoId;

  const { igrejaId } = useIgrejaId();
  const { filialId } = useFilialId();
  const queryClient = useQueryClient();

  // Carregar dados da integração ao abrir em modo edição
  useEffect(() => {
    if (isEditMode && open && integracaoId) {
      const loadIntegracao = async () => {
        try {
          const { data, error } = await supabase
            .from("integracoes_financeiras")
            .select("*")
            .eq("id", integracaoId)
            .single();

          if (error) throw error;

          if (data) {
            setProvedor(data.provedor);
            setCnpj(data.cnpj);
            setAtivo(data.status === "ativo");
            // Não carregamos clientId, clientSecret, applicationKey do banco por motivos de segurança
            // O usuário precisa fornecer novamente ao editar
          }
        } catch (error) {
          console.error("Error loading integration:", error);
          toast.error("Erro ao carregar dados da integração");
        }
      };

      loadIntegracao();
    }
  }, [isEditMode, open, integracaoId]);

  // Limpar form ao fechar
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCnpj("");
        setClientId("");
        setClientSecret("");
        setApplicationKey("");
        setPfxFile(null);
        setPfxPassword("");
        setAtivo(true);
        setProvedor("santander");
      }, 200);
    }
  }, [open]);

  const handlePfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".pfx")) {
      setPfxFile(file);
    } else {
      toast.error("Por favor, selecione um arquivo .pfx válido");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!igrejaId) {
      toast.error("Igreja não identificada");
      return;
    }

    if (!cnpj.trim()) {
      toast.error("CNPJ é obrigatório");
      return;
    }

    // Em modo criação, todas as credenciais são obrigatórias
    if (!isEditMode) {
      if (!clientId.trim()) {
        toast.error("Client ID é obrigatório");
        return;
      }

      if (!clientSecret.trim()) {
        toast.error("Client Secret é obrigatório");
        return;
      }

      if (!pfxFile) {
        toast.error("Arquivo PFX é obrigatório");
        return;
      }

      if (!pfxPassword.trim()) {
        toast.error("Senha do PFX é obrigatória");
        return;
      }

      if (provedor === "getnet" && !applicationKey.trim()) {
        toast.error("Application Key é obrigatória para Getnet");
        return;
      }
    } else {
      // Em modo edição, se fornecer credenciais, todas são obrigatórias
      const hasCredentials = clientId.trim() || clientSecret.trim() || pfxFile || applicationKey.trim();
      if (hasCredentials) {
        if (!clientId.trim()) {
          toast.error("Client ID é obrigatório quando atualizando credenciais");
          return;
        }
        if (!clientSecret.trim()) {
          toast.error("Client Secret é obrigatório quando atualizando credenciais");
          return;
        }
        if (!pfxFile) {
          toast.error("Arquivo PFX é obrigatório quando atualizando credenciais");
          return;
        }
        if (!pfxPassword.trim()) {
          toast.error("Senha do PFX é obrigatória quando atualizando credenciais");
          return;
        }
        if (provedor === "getnet" && !applicationKey.trim()) {
          toast.error("Application Key é obrigatória para Getnet");
          return;
        }
      }
    }

    setLoading(true);

    try {
      if (isEditMode && integracaoId) {
        // Modo edição
        if (!pfxFile) {
          // Atualizar apenas metadados (sem credenciais)
          const { error } = await supabase
            .from("integracoes_financeiras")
            .update({
              cnpj,
              status: ativo ? "ativo" : "inativo",
            })
            .eq("id", integracaoId)
            .eq("igreja_id", igrejaId);

          if (error) throw error;

          toast.success("Integração atualizada com sucesso!");
          await queryClient.invalidateQueries({
            queryKey: ["integracoes_financeiras"],
          });

          onOpenChange(false);
          onSuccess?.();
          setLoading(false);
        } else {
          // Atualizar com novas credenciais
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = (event.target?.result as string)?.split(",")[1];

            if (!base64) {
              toast.error("Erro ao ler arquivo PFX");
              setLoading(false);
              return;
            }

            try {
              const { error } = await supabase.functions.invoke(
                "integracoes-config",
                {
                  body: {
                    action: "update_integracao",
                    id: integracaoId,
                    cnpj,
                    client_id: clientId,
                    client_secret: clientSecret,
                    application_key: applicationKey || undefined,
                    pfx_blob: base64,
                    pfx_password: pfxPassword,
                    ativo,
                    igreja_id: igrejaId,
                  },
                }
              );

              if (error) {
                console.error("Edge Function error:", error);
                toast.error(error?.message || "Erro ao atualizar integração");
                setLoading(false);
                return;
              }

              toast.success("Integração atualizada com sucesso!");
              await queryClient.invalidateQueries({
                queryKey: ["integracoes_financeiras"],
              });

              onOpenChange(false);
              onSuccess?.();
            } catch (err) {
              console.error("Error updating integration:", err);
              toast.error("Erro ao atualizar integração");
            } finally {
              setLoading(false);
            }
          };

          reader.readAsDataURL(pfxFile);
        }
      } else {
        // Modo criação (código original)
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = (event.target?.result as string)?.split(",")[1];

          if (!base64) {
            toast.error("Erro ao ler arquivo PFX");
            setLoading(false);
            return;
          }

          try {
            const { data, error } = await supabase.functions.invoke(
              "integracoes-config",
              {
                body: {
                  action: "create_integracao",
                  provedor,
                  cnpj,
                  client_id: clientId,
                  client_secret: clientSecret,
                  application_key: applicationKey || undefined,
                  pfx_blob: base64,
                  pfx_password: pfxPassword,
                  ativo,
                  igreja_id: igrejaId,
                  filial_id: filialId || undefined,
                },
              }
            );

            if (error) {
              console.error("Edge Function error:", error);
              toast.error(
                error?.message || "Erro ao salvar integração"
              );
              return;
            }

            toast.success("Integração criada com sucesso!");

            // Invalidate queries
            await queryClient.invalidateQueries({
              queryKey: ["integracoes_financeiras"],
            });

            onOpenChange(false);
            onSuccess?.();
          } catch (err) {
            console.error("Error creating integration:", err);
            toast.error("Erro ao criar integração");
          } finally {
            setLoading(false);
          }
        };

        reader.readAsDataURL(pfxFile);
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      toast.error("Erro ao processar integração");
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogHeader>
        <DialogTitle>
          {isEditMode ? "Editar Integração Financeira" : "Nova Integração Financeira"}
        </DialogTitle>
        <DialogDescription>
          {isEditMode
            ? "Atualize os dados da integração com o provedor de serviços financeiros"
            : "Configure uma nova integração com um provedor de serviços financeiros"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provedor">Provedor</Label>
          <Select value={provedor} onValueChange={setProvedor}>
            <SelectTrigger id="provedor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVEDORES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientId">
            Client ID
            {isEditMode && <span className="text-xs text-muted-foreground ml-1">(opcional - deixe em branco para manter)</span>}
          </Label>
          <Input
            id="clientId"
            placeholder="Insira o Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret</Label>
          <Input
            id="clientSecret"
            type="password"
            placeholder="Insira o Client Secret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            disabled={loading}
          />
        </div>

        {(provedor === "getnet" || provedor === "santander") && (
          <div className="space-y-2">
            <Label htmlFor="applicationKey">
              Application Key
              {provedor === "santander" && (
                <span className="text-xs text-muted-foreground ml-1">(geralmente igual ao Client ID)</span>
              )}
            </Label>
            <Input
              id="applicationKey"
              type="password"
              placeholder="Insira a Application Key"
              value={applicationKey}
              onChange={(e) => setApplicationKey(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="pfxFile">
            Arquivo PFX
            {isEditMode && <span className="text-xs text-muted-foreground ml-1">(opcional - deixe em branco para manter)</span>}
          </Label>
          <Input
            id="pfxFile"
            type="file"
            accept=".pfx"
            onChange={handlePfxChange}
            disabled={loading}
          />
          {pfxFile && (
            <p className="text-sm text-muted-foreground">
              ✓ {pfxFile.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pfxPassword">Senha do PFX</Label>
          <Input
            id="pfxPassword"
            type="password"
            placeholder="Insira a senha do arquivo PFX"
            value={pfxPassword}
            onChange={(e) => setPfxPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <Label htmlFor="ativo">Ativo</Label>
          <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? "Salvando..."
              : isEditMode
                ? "Atualizar Integração"
                : "Salvar Integração"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
