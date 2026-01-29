/**
 * Utilitários para normalização e formatação de telefones brasileiros
 * 
 * Padrões:
 * - Armazenamento (banco): DDD + número (10-11 dígitos) - Ex: 17996486580
 * - API WhatsApp: 55 + DDD + número (12-13 dígitos) - Ex: 5517996486580
 */

/**
 * Normaliza telefone para armazenamento (sem código de país)
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
    console.warn(`[telefone-utils] Telefone inválido: ${telefone} -> ${digits} (${digits.length} dígitos)`);
    // Retorna o que temos se tiver algum dígito, senão null
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
  
  // Remove caracteres não numéricos
  const digits = telefone.replace(/\D/g, "");
  
  // Se já tem código de país (55) e mais de 11 dígitos, retorna como está
  if (digits.startsWith("55") && digits.length > 11) {
    return digits;
  }
  
  // Adiciona código do país Brasil
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
