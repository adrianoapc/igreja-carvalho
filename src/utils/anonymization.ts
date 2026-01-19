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
  
  // 1. Anonimizar CNPJs sem formatação primeiro (14 dígitos) → ***###***
  // Deve vir antes do CPF para não conflitar
  result = result.replace(
    /\b(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})\b/g,
    (match, p1, p2, p3, p4, p5) => `***${p2.substring(0, 3)}***`
  );
  
  // 2. Anonimizar CNPJs formatados (##.###.###/####-##) → ***.###.***
  result = result.replace(
    /(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/g,
    (match, p1, p2, p3, p4, p5) => `***.${p2}.***`
  );
  
  // 3. Anonimizar CPFs formatados (###.###.###-##) → ***.###.***
  result = result.replace(
    /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g,
    (match, p1, p2, p3, p4) => `***.${p2}.***`
  );
  
  // 4. Anonimizar chaves PIX que parecem CPF sem formatação (11 dígitos) → ***###***
  result = result.replace(
    /\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g,
    (match, p1, p2, p3, p4) => `***${p2}***`
  );
  
  // 5. Anonimizar e-mails (joao@email.com → j***@e***.com)
  result = result.replace(
    /([a-zA-Z0-9])[a-zA-Z0-9.]*@([a-zA-Z0-9])[a-zA-Z0-9]*\.([a-z]{2,})/gi,
    "$1***@$2***.$3"
  );
  
  // 6. Anonimizar telefones ((11) 99999-1234 → (***) ***-###)
  result = result.replace(
    /\((\d{2})\)\s*(\d{4,5})-(\d{4})/g,
    (match, ddd, prefix, suffix) => `(***) ***-${suffix.substring(1)}`
  );
  
  // 7. Anonimizar telefones sem formatação (11 dígitos começando com DDD)
  result = result.replace(
    /\b(\d{2})(\d{5})(\d{4})\b/g,
    (match, ddd, prefix, suffix) => `***${suffix.substring(1)}***`
  );
  
  // 8. Anonimizar nomes completos em maiúsculo (JOAO CARLOS DA SILVA → JOAO *** SILVA)
  result = result.replace(
    /\b([A-Z]{2,})\s+([A-Z\s]+)\s+([A-Z]{2,})\b/g,
    (match, first, middle, last) => `${first} *** ${last}`
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
