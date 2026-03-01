import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMediaQuery } from "@/hooks/use-media-query";

interface ResetarSenhaDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  pessoaNome: string;
  pessoaEmail: string | null;
  pessoaTelefone?: string | null;
  pessoaIgrejaId?: string | null;
  onSuccess?: () => void;
}

export function ResetarSenhaDialog({
  isOpen,
  onOpenChange,
  pessoaId,
  pessoaNome,
  pessoaEmail,
  pessoaTelefone,
  pessoaIgrejaId,
  onSuccess,
}: ResetarSenhaDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    mensagem: string;
    otpEnviado?: boolean;
  } | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const gerarSenhaTemporaria = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let senha = "";
    for (let i = 0; i < 12; i++) {
      senha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return senha;
  };

  const handleResetarSenha = async () => {
    if (!confirmacao) {
      toast({ title: "Confirmação necessária", description: "Marque a caixa de confirmação para continuar.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const senhaTemporaria = gerarSenhaTemporaria();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-usuario`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
          },
          body: JSON.stringify({
            action: "reset_password",
            profile_id: pessoaId,
            password: senhaTemporaria,
            telefone: pessoaTelefone,
            nome: pessoaNome,
            igreja_id: pessoaIgrejaId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao resetar senha");
      }

      if (result.otp_enviado) {
        setResultado({
          sucesso: true,
          otpEnviado: true,
          mensagem: `Senha resetada para ${pessoaNome}. Um código de verificação foi enviado via WhatsApp para que a pessoa defina uma nova senha.`,
        });
      } else {
        setResultado({
          sucesso: true,
          otpEnviado: false,
          mensagem: `Senha resetada para ${pessoaNome}. Nova senha temporária: ${senhaTemporaria}`,
        });
      }

      toast({
        title: "Senha resetada",
        description: result.otp_enviado
          ? "Código enviado via WhatsApp."
          : "O usuário deverá mudar a senha no próximo acesso.",
      });

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onOpenChange(false);
        setConfirmacao(false);
        setResultado(null);
      }, 4000);
    } catch (error) {
      console.error("Erro ao resetar senha:", error);
      const mensagem = error instanceof Error ? error.message : "Erro desconhecido";

      setResultado({ sucesso: false, mensagem });
      toast({ title: "Erro", description: mensagem, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFechar = () => {
    setConfirmacao(false);
    setResultado(null);
    onOpenChange(false);
  };

  const dialogContent = (
    <>
      {resultado ? (
        <div className="space-y-4">
          <Alert
            className={
              resultado.sucesso
                ? "border-green-600 bg-green-50"
                : "border-red-600 bg-red-50"
            }
          >
            <div className="flex items-start gap-3">
              {resultado.sucesso ? (
                resultado.otpEnviado ? (
                  <MessageSquare className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                )
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <div>
                <p className={resultado.sucesso ? "font-semibold text-green-900" : "font-semibold text-red-900"}>
                  {resultado.mensagem}
                </p>
              </div>
            </div>
          </Alert>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleFechar} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pessoaTelefone ? (
            <Alert className="border-blue-500 bg-blue-50">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <p className="font-semibold">Um código será enviado via WhatsApp</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• A senha atual será invalidada</li>
                  <li>• Um código de verificação será enviado por WhatsApp</li>
                  <li>• A pessoa usará o código para definir uma nova senha</li>
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-600 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <p className="font-semibold">Esta ação:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Gerará uma nova senha temporária</li>
                  <li>• O usuário deverá mudar a senha no próximo acesso</li>
                  <li>• A senha atual será invalidada imediatamente</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <input
              type="checkbox"
              id="confirmacao"
              checked={confirmacao}
              onChange={(e) => setConfirmacao(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="confirmacao" className="text-sm cursor-pointer">
              Confirmo que desejo resetar a senha deste usuário
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="ghost" onClick={handleFechar} disabled={isLoading} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleResetarSenha}
              disabled={isLoading || !confirmacao}
              variant="destructive"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetando...
                </>
              ) : (
                "Resetar Senha"
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Resetar Senha</DrawerTitle>
            <DrawerDescription>
              Resete a senha de {pessoaNome}.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">{dialogContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Resetar Senha</DialogTitle>
          <DialogDescription>
            Resete a senha de {pessoaNome}.
          </DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
