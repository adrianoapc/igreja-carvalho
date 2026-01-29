/**
 * Valida se um CPF é válido
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF é válido, false caso contrário
 */
export function validarCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cpfLimpo = cpf.replace(/\D/g, "");

  // Verifica se tem 11 dígitos
  if (cpfLimpo.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

  // Valida os dígitos verificadores
  let soma = 0;
  let resto;

  // Valida o primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;

  // Valida o segundo dígito verificador
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;

  return true;
}

/**
 * Formata um CPF adicionando pontos e traço
 * @param cpf - CPF a ser formatado (apenas números)
 * @returns CPF formatado (000.000.000-00)
 */
export function formatarCPF(cpf: string): string {
  const cpfLimpo = cpf.replace(/\D/g, "");
  return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Formata um telefone brasileiro
 * @param telefone - Telefone a ser formatado
 * @returns Telefone formatado
 */
export function formatarTelefone(telefone: string): string {
  const telefoneLimpo = telefone.replace(/\D/g, "");
  
  if (telefoneLimpo.length === 11) {
    return telefoneLimpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (telefoneLimpo.length === 10) {
    return telefoneLimpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  
  return telefone;
}

/**
 * Formata um CEP brasileiro
 * @param cep - CEP a ser formatado
 * @returns CEP formatado (00000-000)
 */
export function formatarCEP(cep: string): string {
  const cepLimpo = cep.replace(/\D/g, "");
  return cepLimpo.replace(/(\d{5})(\d{3})/, "$1-$2");
}

/**
 * Remove a formatação de uma string, mantendo apenas números
 * @param valor - Valor a ser limpo
 * @returns String contendo apenas números
 */
export function removerFormatacao(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza telefone brasileiro para armazenamento (sem código de país)
 * Entrada: qualquer formato (+5517996486580, 5517996486580, 17996486580, (17) 99648-6580)
 * Saída: apenas DDD + número (10-11 dígitos)
 * 
 * @param telefone - Telefone em qualquer formato
 * @returns Telefone normalizado ou null se inválido
 */
export function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  // Remove tudo que não é número
  let digits = telefone.replace(/\D/g, "");
  
  // Remove código de país 55 se presente e telefone tem mais de 11 dígitos
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  
  // Validar: deve ter 10 ou 11 dígitos (fixo ou celular)
  if (digits.length < 10 || digits.length > 11) {
    console.warn(`[validators] Telefone inválido: ${telefone} -> ${digits} (${digits.length} dígitos)`);
    return digits.length > 0 ? digits : null;
  }
  
  return digits;
}

/**
 * Formata telefone para envio via API WhatsApp (com código de país)
 * Entrada: formato normalizado do banco (DDD + número) ou qualquer formato
 * Saída: 55 + DDD + número (sempre com código do Brasil)
 * 
 * @param telefone - Telefone (preferencialmente já normalizado)
 * @returns Telefone com código de país ou null se inválido
 */
export function formatarParaWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  const digits = telefone.replace(/\D/g, "");
  
  // Se já tem código de país (55) e mais de 11 dígitos, retorna como está
  if (digits.startsWith("55") && digits.length > 11) {
    return digits;
  }
  
  return `55${digits}`;
}

/**
 * Compara dois telefones de forma normalizada
 * Útil para detecção de duplicatas
 * 
 * @param telefone1 - Primeiro telefone
 * @param telefone2 - Segundo telefone
 * @returns true se os telefones são equivalentes
 */
export function telefonesIguais(
  telefone1: string | null | undefined,
  telefone2: string | null | undefined
): boolean {
  const t1 = normalizarTelefone(telefone1);
  const t2 = normalizarTelefone(telefone2);
  
  if (!t1 || !t2) return false;
  
  return t1 === t2;
}
