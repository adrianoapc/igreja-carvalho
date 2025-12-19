import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/hooks/useAppConfig";
import { LogIn, UserPlus, Mail, ArrowLeft, Loader2, Eye, EyeOff, Lock, Smartphone, MessageSquare, Fingerprint, AlertTriangle, Timer } from "lucide-react";
import { EnableBiometricDialog } from "@/components/auth/EnableBiometricDialog";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import logoCarvalho from "@/assets/logo-carvalho.png";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { parseAuthError } from "@/hooks/useAuthErrors";
import InputMask from "react-input-mask";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthView = "login" | "forgot-password" | "signup" | "phone-otp";
type LoginMethod = "email" | "phone";

// Validação de email simples
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

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
  
  // Estados para validação em tempo real
  const [emailError, setEmailError] = useState<string | null>(null);
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupNome, setSignupNome] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  
  // Estado para cooldown de reenvio OTP
  const [otpCooldown, setOtpCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    isSupported, 
    isEnabled, 
    isLoading: isBiometricLoading, 
    saveLastEmail, 
    getLastEmail, 
    saveRefreshToken, 
    saveAccessToken, 
    authenticateWithBiometric, 
    getRefreshToken, 
    getAccessToken 
  } = useBiometricAuth();
  
  const preferBiometric = searchParams.get("mode") === "biometric";
  const { config, isLoading: isConfigLoading, refreshConfig } = useAppConfig();

  // Limpar cooldown ao desmontar
  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    };
  }, []);

  // Validação de email em tempo real
  useEffect(() => {
    if (loginEmail && loginEmail.length > 3) {
      if (!isValidEmail(loginEmail)) {
        setEmailError("Formato de email inválido");
      } else {
        setEmailError(null);
      }
    } else {
      setEmailError(null);
    }
  }, [loginEmail]);

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
      let sessionError: unknown = null;

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
        setBiometricFailed(true);
        return false;
      }

      navigate('/dashboard', { replace: true });
      return true;
    } catch {
      setBiometricFailed(true);
      return false;
    } finally {
      setIsBiometricAttempting(false);
      setIsAutoBiometricAttempt(false);
    }
  }, [authenticateWithBiometric, getRefreshToken, getAccessToken, isBiometricLoading, isEnabled, isSupported, navigate]);

  // Verificar se usuário já está autenticado ao montar
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        // Erro silencioso
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

  // Iniciar cooldown de OTP
  const startOtpCooldown = useCallback(() => {
    setOtpCooldown(60);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const nome = signupNome.trim();
    const email = signupEmail.trim();
    const password = signupPassword;
    const confirmPassword = signupConfirmPassword;

    // Validar campos
    if (!nome || !email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para continuar.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Validar email
    if (!isValidEmail(email)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Validar se as senhas coincidem
    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas digitadas são diferentes.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
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
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;

      if (authData.session?.refresh_token) {
        saveRefreshToken(authData.session.refresh_token);
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
        setLoginEmail(email);
        setShowBiometricDialog(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
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
        title: "Campos obrigatórios",
        description: "Preencha email e senha para continuar.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido.",
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

      if (error) throw error;

      // Save email for next login
      saveLastEmail(email);
      
      // Salvar tokens para login biométrico
      if (data.session?.access_token) {
        saveAccessToken(data.session.access_token);
      }

      if (data.session?.refresh_token && data.session.refresh_token.length > 50) {
        saveRefreshToken(data.session.refresh_token);
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });

      // Oferecer biometria após login bem-sucedido se ainda não estiver ativada
      if (!isBiometricLoading && isSupported && !isEnabled && data.user) {
        setPendingUserId(data.user.id);
        setLoginEmail(email);
        setShowBiometricDialog(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const phone = loginPhone.replace(/\D/g, "");

    if (!phone || phone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone válido no formato (DD) 9XXXX-XXXX.",
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
      startOtpCooldown();

      toast({
        title: "Código enviado!",
        description: "Verifique seu WhatsApp/SMS para o código de verificação.",
      });
    } catch (error: unknown) {
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
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
        title: "Código incompleto",
        description: "Digite o código de 6 dígitos.",
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
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneForOtp,
      });

      if (error) throw error;

      startOtpCooldown();

      toast({
        title: "Código reenviado!",
        description: "Verifique seu WhatsApp/SMS.",
      });
    } catch (error: unknown) {
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
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
      
      // O loading permanece até o redirect acontecer
    } catch (error: unknown) {
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (!isValidEmail(recoveryEmail)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

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
      const authError = parseAuthError(error);
      toast({
        title: authError.title,
        description: authError.description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricComplete = () => {
    navigate("/dashboard", { replace: true });
  };

  const handleBackFromLogin = () => {
    // Se usuário está na tela de login principal, voltar para index (público)
    navigate("/");
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
              if (cooldownRef.current) {
                clearInterval(cooldownRef.current);
              }
              setOtpCooldown(0);
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
                  disabled={isLoading || otpCooldown > 0}
                >
                  {otpCooldown > 0 ? (
                    <span className="flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      Reenviar em {otpCooldown}s
                    </span>
                  ) : (
                    "Não recebeu? Reenviar código"
                  )}
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
            onClick={() => {
              setAuthView("login");
              setSignupPassword("");
              setSignupConfirmPassword("");
              setSignupNome("");
              setSignupEmail("");
            }}
            className="flex items-center gap-2 text-primary hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para login</span>
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
                  value={signupNome}
                  onChange={(e) => setSignupNome(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
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
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <PasswordStrengthIndicator password={signupPassword} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                <Input
                  id="signup-confirm-password"
                  name="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                {signupConfirmPassword && signupPassword !== signupConfirmPassword && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary" 
                disabled={isLoading || (signupConfirmPassword.length > 0 && signupPassword !== signupConfirmPassword)}
              >
                <UserPlus className="w-4 h-4 mr-2" /> 
                {isLoading ? "Cadastrando..." : "Cadastrar"}
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
            <span>Voltar para login</span>
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
          onClick={handleBackFromLogin}
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
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="username email"
                  disabled={isLoading}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
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
                    value={loginPassword}
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
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <GoogleIcon className="w-4 h-4 mr-2" />
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
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <GoogleIcon className="w-4 h-4 mr-2" />
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
