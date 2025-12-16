import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/hooks/useAppConfig";
import { LogIn, UserPlus, Mail, ArrowLeft, Loader2, Eye, EyeOff, Lock, Smartphone, MessageSquare, Fingerprint, AlertTriangle } from "lucide-react";
import { EnableBiometricDialog } from "@/components/auth/EnableBiometricDialog";
import logoCarvalho from "@/assets/logo-carvalho.png";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import InputMask from "react-input-mask";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthView = "login" | "forgot-password" | "signup" | "phone-otp";
type LoginMethod = "email" | "phone";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isBiometricAttempting, setIsBiometricAttempting] = useState(false);
  const [isAutoBiometricAttempt, setIsAutoBiometricAttempt] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [showBiometricDialog, setShowBiometricDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [authView, setAuthView] = useState<AuthView>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [otpCode, setOtpCode] = useState("");
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const { isSupported, isEnabled, isLoading: isBiometricLoading, saveLastEmail, getLastEmail, saveRefreshToken, saveAccessToken, authenticateWithBiometric, getRefreshToken, getAccessToken } = useBiometricAuth();
  const preferBiometric = searchParams.get("mode") === "biometric";
  const { config, isLoading: isConfigLoading, refreshConfig } = useAppConfig();

  // Função para tentar login com biometria
  const attemptBiometricLogin = useCallback(async (isAuto = false) => {
    const biometricFlag = localStorage.getItem('biometric_enabled') === 'true';
    if (!isSupported || isBiometricLoading || !isEnabled || !biometricFlag) return false;

    setBiometricFailed(false);
    if (isAuto) setIsAutoBiometricAttempt(true);
    setIsBiometricAttempting(true);

    try {
      const verified = await authenticateWithBiometric();
      if (!verified) throw new Error('Biometric verification failed');

      const refreshToken = getRefreshToken();
      const accessToken = getAccessToken();

      let sessionData: Awaited<ReturnType<typeof supabase.auth.refreshSession>>['data'] | null = null;
      let sessionError: any = null;

      if (refreshToken) {
        const result = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        sessionData = result.data;
        sessionError = result.error;
      }

      if ((!sessionData?.session || sessionError) && accessToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        if (result.error) {
          sessionError = result.error;
        } else {
          sessionData = result.data;
        }
      }

      if (sessionError || !sessionData?.session?.user) {
        console.warn('Não foi possível restaurar sessão biométrica:', sessionError?.message);
        setBiometricFailed(true);
        return false;
      }

      navigate('/dashboard', { replace: true });
      return true;
    } catch (error) {
      console.error('Biometric auth failed:', error);
      setBiometricFailed(true);
      return false;
    } finally {
      setIsBiometricAttempting(false);
      setIsAutoBiometricAttempt(false);
    }
  }, [authenticateWithBiometric, getRefreshToken, isBiometricLoading, isEnabled, isSupported, navigate]);

  // Verificar se usuário já está autenticado ao montar
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    if (!isBiometricLoading) {
      checkAuthStatus();
    }
  }, [navigate, isBiometricLoading]);

  // Garantir fetch explícito da configuração de manutenção nesta página
  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

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
    const confirmPassword = formData.get("confirm-password") as string;

    // Validar se as senhas coincidem
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.session?.refresh_token) {
        console.log('[Auth] Saving refresh token (signup):', {
          tokenLength: authData.session.refresh_token.length,
        });
        saveRefreshToken(authData.session.refresh_token);
      } else {
        console.warn('[Auth] No refresh token in signup session:', {
          hasSession: !!authData.session,
          sessionKeys: Object.keys(authData.session || {}),
        });
      }

      toast({
        title: "Cadastro realizado!",
        description: "Bem-vindo! Você pode acessar o sistema.",
      });

      // Salvar email para biometria
      saveLastEmail(email);

      // Oferecer biometria após cadastro bem-sucedido
      if (!isBiometricLoading && isSupported && !isEnabled && authData.user) {
        setPendingUserId(authData.user.id);
        setLoginEmail(email); // Garantir que email está salvo para passar ao diálogo
        setShowBiometricDialog(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro no cadastro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[Auth] Raw signInWithPassword data:', data);
      console.log('[Auth] Raw signInWithPassword error:', error);

      if (error) throw error;

      console.log('[Auth] signInWithPassword response:', {
        hasSession: !!data.session,
        sessionKeys: Object.keys(data.session || {}),
        refresh_token_value: data.session?.refresh_token,
        access_token_value: data.session?.access_token ? data.session.access_token.substring(0, 50) + '...' : 'missing',
        user: data.user?.email,
      });

      // Save email for next login
      saveLastEmail(email);
      
      // Salvar refresh token para login automático com biometria
      // IMPORTANTE: Validar que o refresh token tem um tamanho mínimo (real tokens tem 100+ chars)
      // FALLBACK: Salvar também access_token para uso se refresh_token não estiver disponível
      
      // Sempre salvar access_token como fallback
      if (data.session?.access_token) {
        console.log('[Auth] Saving access token (fallback):', {
          tokenLength: data.session.access_token.length,
          tokenStart: data.session.access_token.substring(0, 50),
        });
        saveAccessToken(data.session.access_token);
      }

      if (data.session?.refresh_token && data.session.refresh_token.length > 50) {
        console.log('[Auth] Saving valid refresh token:', {
          tokenLength: data.session.refresh_token.length,
          tokenStart: data.session.refresh_token.substring(0, 50),
          sessionStorageBefore: sessionStorage.getItem('biometric_refresh_token') ? 'exists' : 'missing',
          localStorageBefore: localStorage.getItem('biometric_refresh_token') ? 'exists' : 'missing',
        });
        saveRefreshToken(data.session.refresh_token);
        console.log('[Auth] After saveRefreshToken:', {
          sessionStorageAfter: sessionStorage.getItem('biometric_refresh_token') ? sessionStorage.getItem('biometric_refresh_token').substring(0, 50) + '...' : 'missing',
          localStorageAfter: localStorage.getItem('biometric_refresh_token') ? localStorage.getItem('biometric_refresh_token').substring(0, 50) + '...' : 'missing',
        });
      } else {
        console.warn('[Auth] Invalid or missing refresh token:', {
          hasToken: !!data.session?.refresh_token,
          tokenLength: data.session?.refresh_token?.length || 0,
          tokenValue: data.session?.refresh_token,
        });
        console.log('[Auth] Will use access_token fallback for biometric login');
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });

      // Oferecer biometria após login bem-sucedido se ainda não estiver ativada
      if (!isBiometricLoading && isSupported && !isEnabled && data.user) {
        setPendingUserId(data.user.id);
        setLoginEmail(email); // Garantir que email está salvo para passar ao diálogo
        setShowBiometricDialog(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro no login",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const phone = loginPhone.replace(/\D/g, ""); // Remove mask

    if (!phone || phone.length < 10) {
      toast({
        title: "Erro",
        description: "Telefone inválido. Use o formato (DD) 9XXXX-XXXX",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const formattedPhone = `+55${phone}`;
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      // Salvar telefone para verificação OTP
      setPhoneForOtp(formattedPhone);
      setAuthView("phone-otp");

      toast({
        title: "Código enviado!",
        description: "Verifique seu WhatsApp/SMS para o código de verificação.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao enviar código",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!otpCode || otpCode.length < 6) {
      toast({
        title: "Erro",
        description: "Digite o código de 6 dígitos",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneForOtp,
        token: otpCode,
        type: "sms",
      });

      if (error) throw error;

      // Salvar refresh token para login automático com biometria
      if (data.session?.refresh_token) {
        saveRefreshToken(data.session.refresh_token);
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo!",
      });

      // Oferecer biometria após login bem-sucedido se ainda não estiver ativada
      if (!isBiometricLoading && isSupported && !isEnabled && data.user) {
        setPendingUserId(data.user.id);
        setShowBiometricDialog(true);
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Código inválido",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneForOtp,
      });

      if (error) throw error;

      toast({
        title: "Código reenviado!",
        description: "Verifique seu WhatsApp/SMS.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao reenviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao entrar com Google",
        description: errorMessage,
        variant: "destructive",
      });
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao enviar email",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricComplete = () => {
    navigate("/dashboard", { replace: true });
  };

  // Se está verificando autenticação, mostrar loading
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {isAutoBiometricAttempt ? "Verificando credenciais..." : "Carregando..."}
          </p>
        </div>
      </div>
    );
  }

  // Tela de verificação OTP
  if (authView === "phone-otp") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mb-4">
          <button
            onClick={() => {
              setAuthView("login");
              setOtpCode("");
            }}
            className="flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
        </div>

        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <img 
              src={logoCarvalho} 
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-3"
            />
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Verificação</CardTitle>
            </div>
            <CardDescription>
              Digite o código de 6 dígitos enviado para seu telefone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                  disabled={isLoading}
                >
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

              <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading || otpCode.length < 6}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Verificar e Entrar
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                >
                  Não recebeu? Reenviar código
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de cadastro
  if (authView === "signup") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mb-4">
          <button
            onClick={() => setAuthView("login")}
            className="flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
        </div>

        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <img 
              src={logoCarvalho} 
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-3"
            />
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Cadastro</CardTitle>
            </div>
            <CardDescription>Crie sua conta para acessar o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-nome">Nome Completo</Label>
                <Input
                  id="signup-nome"
                  name="nome"
                  type="text"
                  placeholder="Seu nome completo"
                  required
                  disabled={isLoading}
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
                  autoComplete="email"
                  disabled={isLoading}
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
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                <Input
                  id="signup-confirm-password"
                  name="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                <UserPlus className="w-4 h-4 mr-2" /> {isLoading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de recuperação de senha
  if (authView === "forgot-password") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mb-4">
          <button 
            onClick={() => setAuthView("login")}
            className="flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
        </div>

        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <img
              src={logoCarvalho}
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-3"
            />
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Recuperar Senha
              </CardTitle>
            </div>
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
                  autoComplete="email"
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
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de login principal
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo e Título */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => navigate(preferBiometric ? '/auth?mode=biometric' : '/biometric-login')}
          className="flex items-center gap-2 text-primary hover:underline text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
      </div>

      {/* Aviso de manutenção */}
      {!isConfigLoading && config.maintenance_mode && (
        <div className="w-full max-w-md mb-4">
          <div className="bg-orange-500 text-white rounded-lg px-3 py-2 shadow-sm flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Modo de manutenção ativo</p>
              <p className="text-xs opacity-90">
                {config.maintenance_message || "O sistema está em manutenção. Apenas admins e técnicos têm acesso completo."}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="text-center">
          <img
            src={logoCarvalho}
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-3"
          />
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              {loginMethod === "email" ? (
                <Lock className="w-5 h-5 text-primary" />
              ) : (
                <Smartphone className="w-5 h-5 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Entrar
            </CardTitle>
          </div>
          <CardDescription>
            {loginMethod === "email" 
              ? "Entre com seu email e senha para acessar o sistema"
              : "Entre com seu telefone para receber um código de acesso"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginMethod === "email" ? (
            <>
              {isSupported && isEnabled && (
                <div className="mb-4">
                  <Button
                    type="button"
                    variant={preferBiometric ? "default" : "outline"}
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => attemptBiometricLogin(false)}
                    disabled={isBiometricAttempting}
                  >
                    <Fingerprint className="w-4 h-4" />
                    {isBiometricAttempting ? "Verificando..." : "Entrar com FaceID/TouchID"}
                  </Button>
                  {biometricFailed && (
                    <p className="text-xs text-muted-foreground mt-1">Não foi possível validar biometria. Tente novamente ou use sua senha.</p>
                  )}
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-6" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  defaultValue={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="username email"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setLoginMethod("phone")}
                  className="text-xs text-primary hover:underline"
                >
                  Entrar com telefone
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    defaultValue={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={() => setAuthView('forgot-password')}
                >
                  Esqueci minha senha
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary"
                disabled={isLoading}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-white border border-gray-200 text-foreground"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </Button>

              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem conta?{" "}
                  <Button
                    variant="link"
                    onClick={() => setAuthView("signup")}
                    className="p-0 h-auto text-primary hover:underline"
                  >
                    Cadastre-se
                  </Button>
                </p>
              </div>
            </form>
            </>
          ) : (
            <form onSubmit={handlePhoneSignIn} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="login-phone">Telefone</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  disabled={isLoading}
                >
                  {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                      {...inputProps}
                      id="login-phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      required
                      autoComplete="tel"
                    />
                  )}
                </InputMask>
                <button
                  type="button"
                  onClick={() => setLoginMethod("email")}
                  className="text-xs text-primary hover:underline"
                >
                  Entrar com e-mail
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Você receberá um código de verificação via SMS/WhatsApp.
              </p>

              <Button
                type="submit"
                className="w-full bg-gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Enviar código
                  </>
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-white border border-gray-200 text-foreground"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </Button>

              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem conta?{" "}
                  <Button
                    variant="link"
                    onClick={() => setAuthView("signup")}
                    className="p-0 h-auto text-primary hover:underline"
                  >
                    Cadastre-se
                  </Button>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <EnableBiometricDialog
        open={showBiometricDialog}
        onOpenChange={setShowBiometricDialog}
        userId={pendingUserId || ''}
        userEmail={loginEmail || getLastEmail() || undefined}
        onComplete={handleBiometricComplete}
      />
    </div>
  );
}
