# 🔧 Solução: Dinâmica Forma → Conta

## Problema Atual

```typescript
// ❌ HARDCODED - QUEBRÁVEL
const contaOfertas = contas?.find(
  (c) => c.nome.toLowerCase().includes("oferta") // E se for "Caixa Ofertas"?
);
const contaSantander = contas?.find(
  (c) => c.nome.toLowerCase().includes("santander") // Específico demais
);

// ❌ MAPEAMENTO POR NOME
const isDinheiro = nomeLower.includes("dinheiro");
const isPix = nomeLower.includes("pix"); // E se for "Pix Transferência"?
```

---

## ✅ Solução: Tabela Dinâmica

### 1. Criar Tabela no Supabase

```sql
-- Nova tabela de mapeamento
CREATE TABLE forma_pagamento_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  prioridade INTEGER DEFAULT 1 COMMENT 'Se forma tem 2+ contas, qual preferência?',
  criado_em TIMESTAMP DEFAULT now(),

  UNIQUE(forma_pagamento_id, conta_id, igreja_id, filial_id),
  CONSTRAINT forma_ativa CHECK (
    -- Validar que forma existe e está ativa (opcional)
  )
);

-- Índices
CREATE INDEX idx_forma_conta_forma ON forma_pagamento_contas(forma_pagamento_id);
CREATE INDEX idx_forma_conta_conta ON forma_pagamento_contas(conta_id);
CREATE INDEX idx_forma_conta_igreja ON forma_pagamento_contas(igreja_id);

-- RLS
ALTER TABLE forma_pagamento_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem sua própria igreja"
  ON forma_pagamento_contas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.igreja_id = forma_pagamento_contas.igreja_id
    )
  );

CREATE POLICY "Apenas admin edita"
  ON forma_pagamento_contas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
        AND user_roles.igreja_id = forma_pagamento_contas.igreja_id
    )
  );
```

### 2. Atualizar formas_pagamento com Taxa

```sql
-- Adicionar coluna de taxa
ALTER TABLE formas_pagamento ADD COLUMN
  taxa_administrativa DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentual (ex: 3.50)';

-- Pode ser nula se não há taxa (dinheiro, pix)
ALTER TABLE formas_pagamento ADD COLUMN
  taxa_administrativa_fixa DECIMAL(10,2) DEFAULT NULL COMMENT 'Taxa em valor fixo (ex: R$ 1.50)';

-- Coluna para indicar se gera lançamento "pago" ou "pendente"
ALTER TABLE formas_pagamento ADD COLUMN
  gera_pago BOOLEAN DEFAULT false COMMENT 'Dinheiro/PIX = true, Cartão = false';
```

---

## 🔄 Refatorar RelatorioOferta.tsx

### Antes (❌ Hardcoded)

```typescript
const handleConfirmarOferta = async (notificationId, metadata) => {
  // Busca contas por nome - FRÁGIL
  const contaOfertas = contas?.find((c) =>
    c.nome.toLowerCase().includes("oferta")
  );
  const contaSantander = contas?.find((c) =>
    c.nome.toLowerCase().includes("santander")
  );

  // Loop pelos valores
  for (const [formaId, valorStr] of Object.entries(valoresMetadata)) {
    const forma = formasPagamento?.find((f) => f.id === formaId);

    // Mapeamento hardcoded
    let contaId = contaSantander.id; // Default
    if (isDinheiro) contaId = contaOfertas.id;

    // Taxa hardcoded
    const taxa = isCartaoCredito ? 3.5 : 2.0;

    // Status hardcoded
    const status = isDinheiro || isPix ? "pago" : "pendente";
  }
};
```

### Depois (✅ Dinâmico)

```typescript
// Query nova: buscar mapeamento forma→conta
const { data: formaContaMapa } = useQuery({
  queryKey: ["forma-conta-mapa", igrejaId, filialId],
  queryFn: async () => {
    if (!igrejaId) return [];

    let query = supabase
      .from("forma_pagamento_contas")
      .select(
        `
        forma_pagamento_id,
        conta_id,
        prioridade,
        contas!inner(id, nome)
      `
      )
      .eq("igreja_id", igrejaId);

    // Preferir mapeamento específico da filial
    if (!isAllFiliais && filialId) {
      query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
    }

    const { data } = await query;
    return data;
  },
  enabled: !!igrejaId,
});

const handleConfirmarOferta = async (notificationId, metadata) => {
  // Nova lógica: usar mapeamento
  for (const [formaId, valorStr] of Object.entries(valoresMetadata)) {
    const valorNumerico = parseFloat(String(valorStr).replace(",", "."));
    if (valorNumerico <= 0) continue;

    const forma = formasPagamento?.find((f) => f.id === formaId);
    if (!forma) continue;

    // 🎯 NOVO: Buscar conta no mapeamento
    const mapeamento = formaContaMapa?.find(
      (m) => m.forma_pagamento_id === formaId
    );

    if (!mapeamento) {
      // Sem mapeamento = erro informativo
      toast.error(
        `Forma "${forma.nome}" não está mapeada para uma conta. ` +
          `Configure em Configurações → Formas de Pagamento`
      );
      setLoading(false);
      return;
    }

    const contaId = mapeamento.conta_id;

    // 🎯 NOVO: Taxa vem da forma
    const taxaAdministrativa = forma.taxa_administrativa || 0;
    const taxaAdministrativaFixa = forma.taxa_administrativa_fixa;

    // 🎯 NOVO: Status vem da forma
    const status = forma.gera_pago ? "pago" : "pendente";
    const dataPagamento = forma.gera_pago ? dataFormatada : null;

    // Calcular taxa
    let taxasAdministrativas = null;
    if (taxaAdministrativa > 0) {
      taxasAdministrativas = valorNumerico * (taxaAdministrativa / 100);
    }
    if (taxaAdministrativaFixa && taxaAdministrativaFixa > 0) {
      taxasAdministrativas =
        (taxasAdministrativas || 0) + taxaAdministrativaFixa;
    }

    const transacao = {
      tipo: "entrada",
      tipo_lancamento: "unico",
      descricao: `Oferta - Culto ${format(
        new Date(metadata.data_evento),
        "dd/MM/yyyy"
      )}`,
      valor: valorNumerico,
      data_vencimento: dataFormatada,
      data_competencia: dataFormatada,
      data_pagamento: dataPagamento,
      conta_id: contaId, // ✅ Agora dinâmico
      categoria_id: categoriaOferta?.id || null,
      forma_pagamento: formaId,
      status: status, // ✅ Agora dinâmico
      taxas_administrativas: taxasAdministrativas, // ✅ Agora dinâmico
      observacoes: `Lançado por: ${metadata.lancado_por}\nConferido por: ${profile?.nome}`,
      lancado_por: userData.user?.id,
      igreja_id: igrejaId,
      filial_id: !isAllFiliais ? filialId : null,
    };

    transacoes.push(transacao);
  }

  // ... resto igual (insert, etc)
};
```

---

## 🎛️ Nova Tela: Configuração (Financas → Configurações)

```typescript
// Nova página: src/pages/financas/ConfiguracaoFormasPagamento.tsx

export default function ConfiguracaoFormasPagamento() {
  // Lista formas de pagamento
  const { data: formas } = useQuery({
    queryKey: ["formas-config", igrejaId],
    queryFn: () =>
      supabase
        .from("formas_pagamento")
        .select("*")
        .eq("igreja_id", igrejaId)
        .eq("ativo", true),
  });

  // Para cada forma, lista suas contas mapeadas
  const { data: mapeamentos } = useQuery({
    queryKey: ["forma-conta-mapa-config", igrejaId],
    queryFn: () =>
      supabase
        .from("forma_pagamento_contas")
        .select(
          `
        *,
        contas(id, nome),
        formas_pagamento(id, nome)
      `
        )
        .eq("igreja_id", igrejaId),
  });

  // Lista contas disponíveis
  const { data: contas } = useQuery({
    queryKey: ["contas-config", igrejaId],
    queryFn: () =>
      supabase
        .from("contas")
        .select("id, nome")
        .eq("igreja_id", igrejaId)
        .eq("ativo", true),
  });

  // Render: Tabela mostrando
  // Forma | Taxa | Gera Pago? | Contas Mapeadas | [Editar]

  // Dialog para editar:
  // - Forma (read-only)
  // - Taxa administrativa (%)
  // - Taxa fixa (R$)
  // - Gera como pago? (toggle)
  // - Selecionar conta(s) (multi-select)
  // - Prioridade se múltiplas

  return (
    <div>
      <h1>Configuração: Formas de Pagamento</h1>
      <Table>
        {formas?.map((forma) => {
          const mappings = mapeamentos?.filter(
            (m) => m.forma_pagamento_id === forma.id
          );
          return (
            <TableRow key={forma.id}>
              <TableCell>{forma.nome}</TableCell>
              <TableCell>{forma.taxa_administrativa}%</TableCell>
              <TableCell>
                {forma.gera_pago ? "✅ Pago" : "⏳ Pendente"}
              </TableCell>
              <TableCell>
                {mappings?.map((m) => m.contas.nome).join(", ")}
              </TableCell>
              <TableCell>
                <Button onClick={() => openEditDialog(forma)}>Editar</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
    </div>
  );
}
```

---

## 📊 Migração: Dados Existentes

```sql
-- Se já há contas "Ofertas" e "Santander"
-- Inserir dados automáticos:

INSERT INTO forma_pagamento_contas
(forma_pagamento_id, conta_id, igreja_id, prioridade)
SELECT
  f.id,
  c.id,
  f.igreja_id,
  1
FROM formas_pagamento f
JOIN contas c ON c.igreja_id = f.igreja_id
WHERE f.ativo = true
  AND (
    (f.nome ILIKE '%dinheiro%' AND c.nome ILIKE '%oferta%')
    OR (f.nome ILIKE '%pix%' AND c.nome ILIKE '%oferta%')
    OR (f.nome ILIKE '%débito%' AND c.nome ILIKE '%santander%')
    OR (f.nome ILIKE '%crédito%' AND c.nome ILIKE '%santander%')
  )
ON CONFLICT (forma_pagamento_id, conta_id, igreja_id, filial_id)
DO NOTHING;

-- Atualizar taxas existentes
UPDATE formas_pagamento SET
  taxa_administrativa = 3.50,
  gera_pago = false
WHERE nome ILIKE '%crédito%' OR nome ILIKE '%credito%';

UPDATE formas_pagamento SET
  taxa_administrativa = 2.00,
  gera_pago = false
WHERE nome ILIKE '%débito%' OR nome ILIKE '%debito%';

UPDATE formas_pagamento SET
  gera_pago = true
WHERE nome ILIKE '%dinheiro%' OR nome ILIKE '%pix%';
```

---

## ✅ Benefícios

| Antes                        | Depois                             |
| ---------------------------- | ---------------------------------- |
| Hardcoded por nome           | Dinâmico via tabela                |
| Quebra se renomear conta     | Não quebra, basta atualizar tabela |
| Taxa fixa no form            | Configurável por forma             |
| Sem auditoria                | Fica registrado na tabela          |
| Uma conta por forma          | Suporta múltiplas (prioridade)     |
| Sem flexibilidade por filial | Pode variar por filial             |
| Sem validação                | Erro informativo se não mapeado    |
| Código acoplado              | Separado em config                 |

---

## 🚀 Próximos Passos

1. Rodar migrations SQL (criar tabelas + campos)
2. Adicionar tabelas ao Supabase (RLS)
3. Refatorar `RelatorioOferta.tsx` com novos queries
4. Criar tela de configuração em `Financas → Configurações`
5. Testar com dados existentes
6. Remover hardcoding de "3.5%" e "2.0%" do form
