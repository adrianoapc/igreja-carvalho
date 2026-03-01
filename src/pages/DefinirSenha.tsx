import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import InputMask from "react-input-mask";
import logoCarvalho from "@/assets/logo-carvalho.png";

export default function DefinirSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const telefoneLimpo = telefone.replace(/\D/g, "");
    if (!telefoneLimpo || telefoneLimpo.length < 10) {
      toast({ title: "Telefone inválido", description: "Digite um telefone válido.", variant: "destructive" });
      return;
    }
    if (codigo.length !== 6) {
      toast({ title: "Código incompleto", description: "Digite o código de 6 dígitos.", variant: "destructive" });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: "Senha curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: "Senhas diferentes", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-otp-senha`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: telefoneLimpo,
            codigo,
            nova_senha: novaSenha,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao definir senha");
      }

      setSucesso(true);
      toast({ title: "Senha definida!", description: "Você já pode fazer login." });

      setTimeout(() => navigate("/auth", { replace: true }), 3000);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold">Senha Definida!</h2>
            <p className="text-muted-foreground">Redirecionando para o login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="text-center">
          <img src={logoCarvalho} alt="Logo" className="h-16 w-auto mx-auto mb-3" />
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Definir Senha</CardTitle>
          </div>
          <CardDescription>
            Digite seu telefone, o código recebido via WhatsApp e crie sua nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <InputMask
                mask="(99) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={isLoading}
              >
                {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                  <Input
                    {...inputProps}
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    required
                  />
                )}
              </InputMask>
            </div>

            <div className="space-y-2">
              <Label>Código de Verificação</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={codigo} onChange={setCodigo} disabled={isLoading}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="nova-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                  minLength={6}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={novaSenha} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar Senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                placeholder="••••••••"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
              {confirmarSenha && novaSenha !== confirmarSenha && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Definir Senha"
              )}
            </Button>

            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/auth")} className="text-sm">
                Voltar para o login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
