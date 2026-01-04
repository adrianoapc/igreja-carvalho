import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import logoCarvalho from "@/assets/logo-carvalho.png";

export default function ForcedPasswordChange() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha deve ter pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha deve ser igual à nova senha.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update password in auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) throw authError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update profile to remove the password change flag
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ deve_trocar_senha: false })
          .eq("user_id", user.id);

        if (profileError) {
          console.error("Erro ao atualizar flag de senha:", profileError);
        }
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você será redirecionado para o sistema.",
      });

      navigate("/", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao alterar senha";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoCarvalho} alt="Logo" className="h-16 w-auto" />
          </div>
          <div className="flex items-center justify-center gap-2 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
            <CardTitle className="text-xl">Troca de Senha Obrigatória</CardTitle>
          </div>
          <CardDescription>
            Por segurança, você precisa criar uma nova senha para continuar acessando o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-10 pr-10"
                  required
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">As senhas não conferem</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar Senha e Continuar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
