

# Plano: Corrigir Dados da Tabela `integracao_voluntario`

## Problema Identificado

A migração anterior criou **6 registros** incorretamente devido a um **cross-join**:

| Situação Atual (ERRADA) | Situação Correta |
|------------------------|------------------|
| 2 candidaturas × 3 trilhas = 6 registros | 2 candidaturas × 1 trilha cada = 2 registros |

**Causa raiz:** O JOIN foi feito em `inscricoes_jornada` pelo `pessoa_id`, o que vinculou TODAS as trilhas ativas a TODAS as candidaturas.

**Correção:** Usar o campo `trilha_requerida_id` da própria tabela `candidatos_voluntario`, que já indica qual jornada específica está vinculada a cada candidatura.

---

## Dados Atuais do Usuário

```text
candidatos_voluntario:
├── Candidatura 1: Mídia → trilha_requerida_id = Trilha de Mídia
└── Candidatura 2: Recepção → trilha_requerida_id = Trilha de Recepção

inscricoes_jornada:
├── Trilha de Mídia
├── Trilha de Recepção  
└── Trilha de Integração (NÃO vinculada a candidatura)
```

---

## Solução

### Passo 1: Limpar registros incorretos

```sql
-- Deletar todos os registros de integracao_voluntario
-- (são apenas 6 registros de teste, todos incorretos)
DELETE FROM integracao_voluntario;
```

### Passo 2: Re-inserir corretamente

```sql
INSERT INTO integracao_voluntario (
  candidato_id,
  mentor_id,
  jornada_id,
  status,
  percentual_jornada,
  data_jornada_iniciada,
  data_conclusao_esperada,
  resultado_teste,
  igreja_id,
  filial_id,
  created_at,
  updated_at
)
SELECT 
  cv.id as candidato_id,
  NULL as mentor_id,
  cv.trilha_requerida_id as jornada_id,  -- ← USA A TRILHA DA CANDIDATURA
  CASE 
    WHEN cv.status = 'em_trilha' THEN 'trilha'::text
    WHEN cv.status = 'aprovado' THEN 'ativo'::text
    ELSE 'entrevista'::text
  END as status,
  -- Buscar progresso real da inscrição na jornada
  COALESCE(
    (SELECT ij.progresso 
     FROM inscricoes_jornada ij 
     WHERE ij.pessoa_id = cv.pessoa_id 
       AND ij.jornada_id = cv.trilha_requerida_id
     LIMIT 1),
    0
  ) as percentual_jornada,
  CASE 
    WHEN cv.status = 'em_trilha' THEN cv.updated_at
    ELSE NULL
  END as data_jornada_iniciada,
  CASE 
    WHEN cv.status = 'em_trilha' THEN cv.updated_at + INTERVAL '30 days'
    ELSE NULL
  END as data_conclusao_esperada,
  'pendente'::text as resultado_teste,
  cv.igreja_id,
  cv.filial_id,
  NOW() as created_at,
  NOW() as updated_at
FROM candidatos_voluntario cv
WHERE cv.status IN ('aprovado', 'em_trilha', 'pendente', 'em_analise')
AND NOT EXISTS (
  SELECT 1 FROM integracao_voluntario 
  WHERE candidato_id = cv.id
);
```

---

## Resultado Esperado

Após a correção:

| candidato_id | ministerio | jornada_id | status |
|--------------|------------|------------|--------|
| uuid-1 | Mídia | Trilha de Mídia | trilha |
| uuid-2 | Recepção | Trilha de Recepção | trilha |

**Total: 2 registros** (1 por candidatura, não 6)

---

## Regra de Negócio Documentada

A tabela `integracao_voluntario` segue a regra:

> **1 candidatura = 1 registro de integração**
> 
> A jornada vinculada é sempre a `trilha_requerida_id` definida na candidatura, não todas as trilhas que a pessoa está cursando.

---

## Arquivos Afetados

| Tipo | Descrição |
|------|-----------|
| SQL (dados) | DELETE + INSERT para corrigir registros |

Nenhum arquivo de código precisa ser alterado, apenas os dados no banco.

