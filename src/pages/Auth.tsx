import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

            // Atribuir cargo padrão "membro"
            await supabase.from("user_roles").insert({
              user_id: authData.user.id,
              role: "membro"
            });

            toast({
              title: "Cadastro vinculado!",
              description: `Seu perfil de ${existingProfile.status} foi promovido para membro.`,
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

          // Atribuir cargo padrão "membro"
          await supabase.from("user_roles").insert({
            user_id: authData.user.id,
            role: "membro"
          });

          toast({
            title: "Cadastro realizado!",
            description: "Bem-vindo à nossa igreja!",
          });
        }

        toast({
          title: "Cadastro realizado!",
          description: "Bem-vindo à nossa igreja!",
        });

        navigate("/");
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });

      navigate("/");
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gradient-primary bg-clip-text text-transparent">
            Sistema Igreja
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
  );
}
