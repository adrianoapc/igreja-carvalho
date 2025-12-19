/**
 * Hook para tratamento de erros de autenticação
 * Mapeia erros do Supabase para mensagens amigáveis em português
 */

export type AuthErrorType = 
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'TOO_MANY_REQUESTS'
  | 'NETWORK_ERROR'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'PHONE_NOT_CONFIGURED'
  | 'GOOGLE_POPUP_BLOCKED'
  | 'GOOGLE_CANCELLED'
  | 'PROVIDER_NOT_ENABLED'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN';

interface AuthError {
  type: AuthErrorType;
  title: string;
  description: string;
  action?: string;
}

// Mapeamento de mensagens de erro do Supabase para tipos
const ERROR_PATTERNS: Record<string, AuthErrorType> = {
  'invalid login credentials': 'INVALID_CREDENTIALS',
  'invalid_credentials': 'INVALID_CREDENTIALS',
  'user not found': 'USER_NOT_FOUND',
  'email not confirmed': 'INVALID_CREDENTIALS',
  'user already registered': 'EMAIL_TAKEN',
  'email already in use': 'EMAIL_TAKEN',
  'password should be at least': 'WEAK_PASSWORD',
  'weak_password': 'WEAK_PASSWORD',
  'invalid email': 'INVALID_EMAIL',
  'email rate limit exceeded': 'TOO_MANY_REQUESTS',
  'rate limit': 'TOO_MANY_REQUESTS',
  'too many requests': 'TOO_MANY_REQUESTS',
  'over_request_rate_limit': 'TOO_MANY_REQUESTS',
  'fetch failed': 'NETWORK_ERROR',
  'network': 'NETWORK_ERROR',
  'otp expired': 'OTP_EXPIRED',
  'token expired': 'OTP_EXPIRED',
  'invalid otp': 'OTP_INVALID',
  'otp_invalid': 'OTP_INVALID',
  'phone auth not enabled': 'PHONE_NOT_CONFIGURED',
  'sms not enabled': 'PHONE_NOT_CONFIGURED',
  'provider not enabled': 'PROVIDER_NOT_ENABLED',
  'popup closed': 'GOOGLE_CANCELLED',
  'popup_closed_by_user': 'GOOGLE_CANCELLED',
  'popup blocked': 'GOOGLE_POPUP_BLOCKED',
  'session expired': 'SESSION_EXPIRED',
  'refresh_token_not_found': 'SESSION_EXPIRED',
};

// Mensagens de erro amigáveis
const ERROR_MESSAGES: Record<AuthErrorType, AuthError> = {
  INVALID_CREDENTIALS: {
    type: 'INVALID_CREDENTIALS',
    title: 'Credenciais inválidas',
    description: 'Email ou senha incorretos. Verifique seus dados e tente novamente.',
    action: 'Esqueceu sua senha? Clique em "Esqueci minha senha".'
  },
  USER_NOT_FOUND: {
    type: 'USER_NOT_FOUND',
    title: 'Usuário não encontrado',
    description: 'Não encontramos uma conta com este email.',
    action: 'Verifique o email ou crie uma nova conta.'
  },
  EMAIL_TAKEN: {
    type: 'EMAIL_TAKEN',
    title: 'Email já cadastrado',
    description: 'Já existe uma conta com este email.',
    action: 'Tente fazer login ou recupere sua senha.'
  },
  WEAK_PASSWORD: {
    type: 'WEAK_PASSWORD',
    title: 'Senha muito fraca',
    description: 'A senha deve ter pelo menos 6 caracteres.',
    action: 'Use uma combinação de letras e números.'
  },
  INVALID_EMAIL: {
    type: 'INVALID_EMAIL',
    title: 'Email inválido',
    description: 'O formato do email está incorreto.',
    action: 'Verifique se digitou o email corretamente.'
  },
  TOO_MANY_REQUESTS: {
    type: 'TOO_MANY_REQUESTS',
    title: 'Muitas tentativas',
    description: 'Você fez muitas tentativas. Aguarde alguns minutos.',
    action: 'Tente novamente em 5 minutos.'
  },
  NETWORK_ERROR: {
    type: 'NETWORK_ERROR',
    title: 'Erro de conexão',
    description: 'Não foi possível conectar ao servidor.',
    action: 'Verifique sua conexão com a internet.'
  },
  OTP_EXPIRED: {
    type: 'OTP_EXPIRED',
    title: 'Código expirado',
    description: 'O código de verificação expirou.',
    action: 'Solicite um novo código.'
  },
  OTP_INVALID: {
    type: 'OTP_INVALID',
    title: 'Código inválido',
    description: 'O código digitado está incorreto.',
    action: 'Verifique o código e tente novamente.'
  },
  PHONE_NOT_CONFIGURED: {
    type: 'PHONE_NOT_CONFIGURED',
    title: 'Login por telefone indisponível',
    description: 'O login por telefone não está configurado.',
    action: 'Use email e senha ou Google para entrar.'
  },
  GOOGLE_POPUP_BLOCKED: {
    type: 'GOOGLE_POPUP_BLOCKED',
    title: 'Popup bloqueado',
    description: 'O navegador bloqueou a janela de login do Google.',
    action: 'Permita popups para este site e tente novamente.'
  },
  GOOGLE_CANCELLED: {
    type: 'GOOGLE_CANCELLED',
    title: 'Login cancelado',
    description: 'O login com Google foi cancelado.',
    action: 'Clique novamente para tentar.'
  },
  PROVIDER_NOT_ENABLED: {
    type: 'PROVIDER_NOT_ENABLED',
    title: 'Método indisponível',
    description: 'Este método de login não está habilitado.',
    action: 'Use email e senha para entrar.'
  },
  SESSION_EXPIRED: {
    type: 'SESSION_EXPIRED',
    title: 'Sessão expirada',
    description: 'Sua sessão expirou. Faça login novamente.',
    action: 'Entre com suas credenciais.'
  },
  UNKNOWN: {
    type: 'UNKNOWN',
    title: 'Erro inesperado',
    description: 'Ocorreu um erro. Tente novamente.',
    action: 'Se o problema persistir, entre em contato.'
  }
};

export function parseAuthError(error: unknown): AuthError {
  const errorMessage = error instanceof Error 
    ? error.message.toLowerCase() 
    : String(error).toLowerCase();

  // Procurar padrão correspondente
  for (const [pattern, errorType] of Object.entries(ERROR_PATTERNS)) {
    if (errorMessage.includes(pattern)) {
      return ERROR_MESSAGES[errorType];
    }
  }

  return ERROR_MESSAGES.UNKNOWN;
}

export function useAuthErrors() {
  return { parseAuthError };
}
