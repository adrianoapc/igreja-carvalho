import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { EnableBiometricDialog } from "@/components/auth/EnableBiometricDialog";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

type AuthView = "login" | "forgot-password";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricDialog, setShowBiometricDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [authView, setAuthView] = useState<AuthView>("login");
  const { isSupported, isEnabled, saveLastEmail, getLastEmail } = useBiometricAuth();

  // Load last used email on mount
  useEffect(() => {
    const lastEmail = getLastEmail();
    if (lastEmail) {
      setLoginEmail(lastEmail);
    }
  }, [getLastEmail]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const nome = formData.get("nome") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Save email for next login
        saveLastEmail(email);

        // Verificar se já existe um perfil com este email
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, user_id, status, observacoes")
          .eq("email", email)
          .single();

        if (existingProfile) {
          // Se já existe um perfil
          if (existingProfile.user_id) {
            // Se já tem user_id associado, email já está em uso
            throw new Error("Este email já está cadastrado no sistema.");
          } else {
            // Se não tem user_id, é visitante/frequentador - vamos associar
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                user_id: authData.user.id,
                nome, // Atualizar nome também
                status: "membro", // Promover para membro
                data_cadastro_membro: new Date().toISOString(),
                observacoes: existingProfile.observacoes 
                  ? `${existingProfile.observacoes}\n\n[${new Date().toLocaleString('pt-BR')}] ${existingProfile.status} → membro (login criado)`
                  : `[${new Date().toLocaleString('pt-BR')}] ${existingProfile.status} → membro (login criado)`
              })
              .eq("id", existingProfile.id);

            if (updateError) throw updateError;

            // Atribuir cargo padrão "basico" - admin poderá promover depois
            await supabase.from("user_roles").insert({
              user_id: authData.user.id,
              role: "basico"
            });

            toast({
              title: "Cadastro vinculado!",
              description: `Seu perfil de ${existingProfile.status} foi promovido para membro. Acesso básico liberado.`,
            });
          }
        } else {
          // Não existe perfil, criar novo
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: authData.user.id,
              nome,
              email,
              status: "membro",
              data_cadastro_membro: new Date().toISOString()
            });

          if (profileError) throw profileError;

          // Atribuir cargo padrão "basico" - admin poderá promover depois
          await supabase.from("user_roles").insert({
            user_id: authData.user.id,
            role: "basico"
          });

          toast({
            title: "Cadastro realizado!",
            description: "Bem-vindo! Você tem acesso básico ao sistema.",
          });
        }

        // Oferecer biometria após cadastro bem-sucedido
        if (isSupported && !isEnabled) {
          setPendingUserId(authData.user.id);
          setShowBiometricDialog(true);
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Save email for next login
      saveLastEmail(email);

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });

      // Oferecer biometria após login bem-sucedido se ainda não estiver ativada
      if (isSupported && !isEnabled && data.user) {
        setPendingUserId(data.user.id);
        setShowBiometricDialog(true);
      } else {
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      
      // Voltar para a tela de login
      setAuthView("login");
      setRecoveryEmail("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricComplete = () => {
    navigate("/");
  };

  // Tela de recuperação de senha
  if (authView === "forgot-password") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/public" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Recuperar Senha
              </CardTitle>
              <CardDescription>
                Digite seu email para receber o link de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar link de recuperação
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setAuthView("login")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton backTo="/public" />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Área do Membro
            </CardTitle>
            <CardDescription>
              Entre ou cadastre-se para acessar o sistema
            </CardDescription>
          </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(loginEmail);
                    setAuthView("forgot-password");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nome">Nome Completo</Label>
                  <Input
                    id="signup-nome"
                    name="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isLoading ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>

      <EnableBiometricDialog
        open={showBiometricDialog}
        onOpenChange={setShowBiometricDialog}
        userId={pendingUserId || ''}
        onComplete={handleBiometricComplete}
      />
    </div>
  );
}