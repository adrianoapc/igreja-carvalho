/**
 * Funções de anonimização para conformidade com LGPD
 * Aplica mascaramento parcial a dados pessoais sensíveis
 */

/**
 * Anonimiza dados sensíveis em descrições de transações PIX
 * Detecta e mascara: CPF, CNPJ, e-mail, telefone e nomes
 */
export function anonymizePixDescription(text: string): string {
  if (!text) return text;
  
  let result = text;
  
  // 1. Anonimizar CPFs (###.###.###-##) → ***.###.###-**
  result = result.replace(
    /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g,
    "***.$2.$3-**"
  );
  
  // 2. Anonimizar CNPJs (##.###.###/####-##) → **.###.###/****-**
  result = result.replace(
    /(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/g,
    "**.$2.$3/****-**"
  );
  
  // 3. Anonimizar e-mails (joao@email.com → j***@e***.com)
  result = result.replace(
    /([a-zA-Z0-9])[a-zA-Z0-9.]*@([a-zA-Z0-9])[a-zA-Z0-9]*\.([a-z]{2,})/gi,
    "$1***@$2***.$3"
  );
  
  // 4. Anonimizar telefones ((11) 99999-1234 → (**) *****-1234)
  result = result.replace(
    /\((\d{2})\)\s*(\d{4,5})-(\d{4})/g,
    "(**) *****-$3"
  );
  
  // 5. Anonimizar nomes completos em maiúsculo (JOAO CARLOS DA SILVA → JOAO *** SILVA)
  result = result.replace(
    /\b([A-Z]{2,})\s+([A-Z\s]+)\s+([A-Z]{2,})\b/g,
    (match, first, middle, last) => `${first} *** ${last}`
  );
  
  // 6. Anonimizar chaves PIX que parecem CPF sem formatação (11 dígitos)
  result = result.replace(
    /\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g,
    "***$2$3**"
  );
  
  return result;
}

/**
 * Verifica se um texto contém dados potencialmente sensíveis
 */
export function containsSensitiveData(text: string): boolean {
  if (!text) return false;
  
  const patterns = [
    /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
    /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, // CNPJ
    /[a-zA-Z0-9.]+@[a-zA-Z0-9]+\.[a-z]{2,}/i, // E-mail
    /\(\d{2}\)\s*\d{4,5}-\d{4}/, // Telefone
  ];
  
  return patterns.some(pattern => pattern.test(text));
}
