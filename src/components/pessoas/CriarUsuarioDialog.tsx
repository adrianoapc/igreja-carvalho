import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, AlertCircle, CheckCircle, Copy, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMediaQuery } from "@/hooks/use-media-query";

interface CriarUsuarioDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  pessoaNome: string;
  pessoaEmail: string | null;
  pessoaTelefone?: string | null;
  pessoaIgrejaId?: string | null;
  onSuccess?: () => void;
}

export function CriarUsuarioDialog({
  isOpen,
  onOpenChange,
  pessoaId,
  pessoaNome,
  pessoaEmail,
  pessoaTelefone,
  pessoaIgrejaId,
  onSuccess,
}: CriarUsuarioDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState(pessoaEmail || "");
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    mensagem: string;
    detalhes?: string;
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

  const validarEmail = (emailToValidate: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailToValidate);
  };

  const handleCriarUsuario = async () => {
    if (!email.trim()) {
      toast({ title: "Email obrigatório", description: "Por favor, preencha o email da pessoa.", variant: "destructive" });
      return;
    }

    if (!validarEmail(email)) {
      toast({ title: "Email inválido", description: "Por favor, insira um email válido.", variant: "destructive" });
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
            action: "create_user",
            profile_id: pessoaId,
            email: email,
            password: senhaTemporaria,
            telefone: pessoaTelefone,
            nome: pessoaNome,
            igreja_id: pessoaIgrejaId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao criar usuário");
      }

      if (result.otp_enviado) {
        // OTP enviado via WhatsApp
        setResultado({
          sucesso: true,
          otpEnviado: true,
          mensagem: `Usuário criado para ${pessoaNome}!`,
          detalhes: `Um código de verificação foi enviado para o WhatsApp de ${pessoaNome}. A pessoa deve acessar a tela "Definir Senha" para criar sua senha.`,
        });
      } else {
        // Fallback sem telefone - mostrar senha temporária
        setResultado({
          sucesso: true,
          otpEnviado: false,
          mensagem: `Usuário criado com sucesso para ${pessoaNome}!`,
          detalhes: `Email: ${email}\nSenha temporária: ${senhaTemporaria}\n\nA pessoa será solicitada a mudar a senha no primeiro acesso.`,
        });
      }

      toast({ title: "Usuário criado", description: `Acesso criado para ${pessoaNome}.` });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      const mensagem = error instanceof Error ? error.message : "Erro desconhecido";

      setResultado({
        sucesso: false,
        mensagem: "Erro ao criar usuário",
        detalhes: mensagem,
      });

      toast({ title: "Erro", description: mensagem, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copiarParaClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: "Copiado!", description: "Credenciais copiadas para a área de transferência." });
  };

  const handleFechar = () => {
    setEmail(pessoaEmail || "");
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
                {resultado.detalhes && (
                  <AlertDescription className="mt-2 whitespace-pre-wrap text-sm">
                    {resultado.detalhes}
                  </AlertDescription>
                )}
              </div>
            </div>
          </Alert>

          {resultado.sucesso && !resultado.otpEnviado && resultado.detalhes && (
            <Button onClick={() => copiarParaClipboard(resultado.detalhes!)} variant="outline" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copiar Credenciais
            </Button>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleFechar} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Usuário *</Label>
            <Input
              id="email"
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || !!pessoaEmail}
              autoFocus
            />
            {pessoaEmail && (
              <p className="text-sm text-muted-foreground">
                Email do perfil será usado automaticamente.
              </p>
            )}
          </div>

          {pessoaTelefone ? (
            <Alert className="border-blue-500 bg-blue-50">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Um código de verificação será enviado via WhatsApp para que a pessoa defina sua própria senha.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Sem telefone cadastrado. Uma senha temporária será gerada e o usuário deverá trocá-la no primeiro acesso.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="ghost" onClick={handleFechar} disabled={isLoading} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleCriarUsuario} disabled={isLoading || !email.trim()} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Usuário"
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
            <DrawerTitle>Criar Acesso ao Sistema</DrawerTitle>
            <DrawerDescription>
              Crie uma conta de usuário para {pessoaNome} acessar o sistema.
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
          <DialogTitle>Criar Acesso ao Sistema</DialogTitle>
          <DialogDescription>
            Crie uma conta de usuário para {pessoaNome} acessar o sistema.
          </DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
