// Função utilitária para aplicar máscara simples de telefone
export function maskTelefone(valor: string, tipo: string) {
  let v = valor.replace(/\D/g, "");
  if (tipo === "celular") {
    v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, function(_m, d1, d2, d3) {
      if (d3) return `(${d1}) ${d2}-${d3}`;
      if (d2) return `(${d1}) ${d2}`;
      if (d1) return `(${d1}`;
      return "";
    });
  } else {
    v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, function(_m, d1, d2, d3) {
      if (d3) return `(${d1}) ${d2}-${d3}`;
      if (d2) return `(${d1}) ${d2}`;
      if (d1) return `(${d1}`;
      return "";
    });
  }
  return v;
}
