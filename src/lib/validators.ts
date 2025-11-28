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
