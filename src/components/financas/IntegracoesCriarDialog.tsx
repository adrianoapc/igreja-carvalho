import { useState, useEffect } from "react";
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

interface IntegracaoCriarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  integracaoId?: string | null;
}

const PROVEDORES = ["santander", "getnet", "api_generico"] as const;
type TipoAuth = "token" | "sftp";

export function IntegracaoCriarDialog({
  open,
  onOpenChange,
  onSuccess,
  integracaoId,
}: IntegracaoCriarDialogProps) {
  const [provedor, setProvedor] = useState<string>("santander");
  const [tipoAuth, setTipoAuth] = useState<TipoAuth>("token");
  const [cnpj, setCnpj] = useState("");

  // Token credentials
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [pixClientId, setPixClientId] = useState("");
  const [pixClientSecret, setPixClientSecret] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState("");

  // SFTP credentials
  const [sftpHost, setSftpHost] = useState("");
  const [sftpPort, setSftpPort] = useState("22");
  const [sftpUsername, setSftpUsername] = useState("");
  const [sftpPassword, setSftpPassword] = useState("");
  const [sftpPath, setSftpPath] = useState("");

  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const isEditMode = !!integracaoId;

  const { igrejaId } = useIgrejaId();
  const { filialId } = useFilialId();
  const queryClient = useQueryClient();

  // Santander sempre exige certificado (mTLS) — força token
  const isSantander = provedor === "santander";
  const effectiveTipoAuth: TipoAuth = isSantander ? "token" : tipoAuth;

  useEffect(() => {
    if (isEditMode && open && integracaoId) {
      const load = async () => {
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
            // @ts-expect-error tipo_auth pode não estar nos types gerados ainda
            const t = (data.tipo_auth ?? "token") as TipoAuth;
            setTipoAuth(t === "sftp" ? "sftp" : "token");
          }
        } catch (err) {
          console.error("Error loading integration:", err);
          toast.error("Erro ao carregar dados da integração");
        }
      };
      load();
    }
  }, [isEditMode, open, integracaoId]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCnpj("");
        setClientId("");
        setClientSecret("");
        setApplicationKey("");
        setPixClientId("");
        setPixClientSecret("");
        setPfxFile(null);
        setPfxPassword("");
        setSftpHost("");
        setSftpPort("22");
        setSftpUsername("");
        setSftpPassword("");
        setSftpPath("");
        setAtivo(true);
        setProvedor("santander");
        setTipoAuth("token");
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

  const validateBeforeSubmit = (): string | null => {
    if (!cnpj.trim()) return "CNPJ é obrigatório";

    if (effectiveTipoAuth === "sftp") {
      if (!isEditMode) {
        if (!sftpHost.trim()) return "Endereço (host) SFTP é obrigatório";
        if (!sftpUsername.trim()) return "Usuário SFTP é obrigatório";
        if (!sftpPassword.trim()) return "Senha SFTP é obrigatória";
      }
      return null;
    }

    // Token mode
    if (!isEditMode) {
      if (!clientId.trim()) return "Client ID é obrigatório";
      if (!clientSecret.trim()) return "Client Secret é obrigatório";
      if (isSantander) {
        if (!pfxFile) return "Arquivo PFX é obrigatório";
        if (!pfxPassword.trim()) return "Senha do PFX é obrigatória";
      }
      if (provedor === "getnet" && !applicationKey.trim()) {
        return "Application Key é obrigatória para Getnet";
      }
    }
    return null;
  };

  const buildSecretsPayload = (pfxBase64?: string | null) => {
    if (effectiveTipoAuth === "sftp") {
      return {
        sftp_host: sftpHost || undefined,
        sftp_port: sftpPort || undefined,
        sftp_username: sftpUsername || undefined,
        sftp_password: sftpPassword || undefined,
        sftp_path: sftpPath || undefined,
      };
    }
    return {
      client_id: clientId || undefined,
      client_secret: clientSecret || undefined,
      application_key: applicationKey || undefined,
      pix_client_id: pixClientId || undefined,
      pix_client_secret: pixClientSecret || undefined,
      pfx_blob: pfxBase64 ?? undefined,
      pfx_password: pfxPassword || undefined,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      toast.error("Igreja não identificada");
      return;
    }
    const err = validateBeforeSubmit();
    if (err) {
      toast.error(err);
      return;
    }

    setLoading(true);

    const action = isEditMode ? "update_integracao" : "create_integracao";

    const send = async (pfxBase64: string | null) => {
      try {
        const body: Record<string, unknown> = {
          action,
          igreja_id: igrejaId,
          cnpj,
          ativo,
          tipo_auth: effectiveTipoAuth,
          ...buildSecretsPayload(pfxBase64),
        };
        if (isEditMode) {
          body.id = integracaoId;
        } else {
          body.provedor = provedor;
          body.filial_id = filialId || undefined;
        }

        const { error } = await supabase.functions.invoke("integracoes-config", {
          body,
        });

        if (error) {
          console.error("Edge Function error:", error);
          toast.error(error?.message || "Erro ao salvar integração");
          return;
        }

        toast.success(
          isEditMode
            ? "Integração atualizada com sucesso!"
            : "Integração criada com sucesso!"
        );
        await queryClient.invalidateQueries({
          queryKey: ["integracoes_financeiras"],
        });
        onOpenChange(false);
        onSuccess?.();
      } catch (err2) {
        console.error("Error saving integration:", err2);
        toast.error("Erro ao salvar integração");
      } finally {
        setLoading(false);
      }
    };

    if (effectiveTipoAuth === "token" && pfxFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string)?.split(",")[1] ?? null;
        send(base64);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler arquivo PFX");
        setLoading(false);
      };
      reader.readAsDataURL(pfxFile);
    } else {
      send(null);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0",
      }}
    >
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <DialogTitle>
          {isEditMode ? "Editar Integração Financeira" : "Nova Integração Financeira"}
        </DialogTitle>
        <DialogDescription>
          {isEditMode
            ? "Atualize os dados da integração com o provedor de serviços financeiros"
            : "Configure uma nova integração com um provedor de serviços financeiros"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Provedor + CNPJ */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provedor">Provedor</Label>
              <Select value={provedor} onValueChange={setProvedor} disabled={isEditMode}>
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
          </div>

          {/* Tipo de Autenticação — escondido para Santander (sempre mTLS/token) */}
          {!isSantander && (
            <div className="space-y-2">
              <Label htmlFor="tipoAuth">Tipo de Integração</Label>
              <Select
                value={tipoAuth}
                onValueChange={(v) => setTipoAuth(v as TipoAuth)}
              >
                <SelectTrigger id="tipoAuth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="token">
                    Token (Client ID / Client Secret)
                  </SelectItem>
                  <SelectItem value="sftp">SFTP (Host / Usuário / Senha)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Algumas conciliadoras (ex.: Getnet) entregam extratos via SFTP em vez de
                API com token.
              </p>
            </div>
          )}

          {/* ====== MODO TOKEN ====== */}
          {effectiveTipoAuth === "token" && isSantander && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Open Banking (Cash Management)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    App <strong>Cash Management</strong> no portal Santander Developers.
                    Usadas para saldo, extrato e sync.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">
                    Client ID
                    {isEditMode && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (opcional)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="clientId"
                    placeholder="Client ID Open Banking"
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
                    placeholder="Client Secret Open Banking"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationKey">
                    Application Key
                    <span className="text-xs text-muted-foreground ml-1">
                      (geralmente = Client ID)
                    </span>
                  </Label>
                  <Input
                    id="applicationKey"
                    type="password"
                    placeholder="X-Application-Key"
                    value={applicationKey}
                    onChange={(e) => setApplicationKey(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">PIX</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    App <strong>PIX</strong> separada. Usada para cobranças, recebidos e
                    webhooks. Em branco = usa OB como fallback.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixClientId">Client ID (PIX)</Label>
                  <Input
                    id="pixClientId"
                    placeholder="Client ID PIX"
                    value={pixClientId}
                    onChange={(e) => setPixClientId(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixClientSecret">Client Secret (PIX)</Label>
                  <Input
                    id="pixClientSecret"
                    type="password"
                    placeholder="Client Secret PIX"
                    value={pixClientSecret}
                    onChange={(e) => setPixClientSecret(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {effectiveTipoAuth === "token" && !isSantander && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientId">
                  Client ID
                  {isEditMode && (
                    <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                  )}
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

              {provedor === "getnet" && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="applicationKey">Application Key</Label>
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
            </div>
          )}

          {/* PFX só faz sentido em modo token */}
          {effectiveTipoAuth === "token" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pfxFile">
                  Arquivo PFX
                  {(isEditMode || !isSantander) && (
                    <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
                  )}
                </Label>
                <Input
                  id="pfxFile"
                  type="file"
                  accept=".pfx"
                  onChange={handlePfxChange}
                  disabled={loading}
                />
                {pfxFile && (
                  <p className="text-sm text-muted-foreground truncate">
                    ✓ {pfxFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pfxPassword">Senha do PFX</Label>
                <Input
                  id="pfxPassword"
                  type="password"
                  placeholder="Senha do arquivo PFX"
                  value={pfxPassword}
                  onChange={(e) => setPfxPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* ====== MODO SFTP ====== */}
          {effectiveTipoAuth === "sftp" && (
            <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Credenciais SFTP</p>
                <p className="text-xs text-muted-foreground mt-1">
                  O sistema fará download dos arquivos de extrato do servidor SFTP do
                  provedor.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                <div className="space-y-2">
                  <Label htmlFor="sftpHost">
                    Host / Endereço
                    {isEditMode && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (opcional)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="sftpHost"
                    placeholder="sftp.provedor.com.br"
                    value={sftpHost}
                    onChange={(e) => setSftpHost(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sftpPort">Porta</Label>
                  <Input
                    id="sftpPort"
                    placeholder="22"
                    value={sftpPort}
                    onChange={(e) => setSftpPort(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sftpUsername">Usuário</Label>
                  <Input
                    id="sftpUsername"
                    placeholder="usuario_sftp"
                    value={sftpUsername}
                    onChange={(e) => setSftpUsername(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sftpPassword">Senha</Label>
                  <Input
                    id="sftpPassword"
                    type="password"
                    placeholder="Senha SFTP"
                    value={sftpPassword}
                    onChange={(e) => setSftpPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sftpPath">Caminho remoto (opcional)</Label>
                <Input
                  id="sftpPath"
                  placeholder="/extratos/ ou /out/"
                  value={sftpPath}
                  onChange={(e) => setSftpPath(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="ativo">Ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t bg-background">
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
