# Padrão de Timezone da Aplicação

## Resumo Executivo

Esta aplicação funciona exclusivamente com **datas/horas no horário local do usuário (fuso-horário de São Paulo: UTC-3)**. Todas as operações de parsing, formatação e filtragem de datas devem usar as funções utilitárias da aplicação, nunca as funções padrão do `date-fns`.

**Não use:** `parseISO()`, `new Date(string)`, `startOfMonth()`, `endOfMonth()`, `format(date, 'yyyy-MM-dd')`

**Use sempre:** `parseLocalDate()`, `formatLocalDate()`, `startOfMonthLocal()`, `endOfMonthLocal()`

---

## Problema Raiz

### Cenário Problemático

A aplicação brasileira funciona no fuso UTC-3. Quando usamos `parseISO('2024-12-25')` ou `new Date('2024-12-25')`, o JavaScript interpreta como UTC e converte para a timezone local:

```typescript
// ❌ ERRADO - Causa offset de -3 horas
const data = parseISO('2024-12-25');
// Resultado: 24 de dezembro às 21:00 (dia anterior!)

const data2 = new Date('2024-12-25');
// Mesmo problema
```

**Cenário real vivido:** 
- Usuário visualiza "Dezembro" no filtro
- Backend envia datas em ISO: `'2024-12-25'`
- Frontend converte para UTC e subtrai -3h: **2024-12-24 às 21:00**
- Resultado: Transações de dezembro aparecem categorizadas em novembro ❌

### Por Que Acontece?

A string ISO `'2024-12-25'` é interpretada como **UTC midnight (00:00 UTC)**:
- Horário UTC: 2024-12-25 00:00
- Horário São Paulo (UTC-3): 2024-12-24 21:00
- Resultado: Data "pula" para o dia anterior

---

## Solução: Funções Utilitárias

Todas as funções estão em `@/utils/dateUtils.ts`:

### 1. **parseLocalDate(string)** - Parsing Seguro

Interpreta a string como horário local sem conversão UTC:

```typescript
import { parseLocalDate } from '@/utils/dateUtils';

// ✅ CORRETO
const data = parseLocalDate('2024-12-25');
// Resultado: 2024-12-25 00:00 (horário local)

const dataComHora = parseLocalDate('2024-12-25 14:30');
// Resultado: 2024-12-25 14:30 (horário local)
```

**Quando usar:**
- Receber datas de queries do Supabase
- Converter strings de entrada do usuário
- Parse de datas em ISO que devem ser locais
- Sempre que receber um `string` de data

### 2. **formatLocalDate(date)** - Formatação Segura

Formata uma data para ISO local sem conversão de timezone:

```typescript
import { formatLocalDate } from '@/utils/dateUtils';

const data = new Date(2024, 11, 25); // Dec 25, 2024 (local)
const formatted = formatLocalDate(data);
// Resultado: '2024-12-25'
```

**Quando usar:**
- Enviar datas para queries Supabase (filtros WHERE)
- Serializar datas em payloads JSON
- Passar datas como parâmetros RPC
- Queries de intervalo de datas

### 3. **startOfMonthLocal() / endOfMonthLocal()**

Retorna o primeiro/último dia do mês em horário local:

```typescript
import { startOfMonthLocal, endOfMonthLocal } from '@/utils/dateUtils';

const inicio = startOfMonthLocal(new Date(2024, 11, 15)); // Any day in Dec
// Resultado: 2024-12-01 00:00 (horário local)

const fim = endOfMonthLocal(new Date(2024, 11, 15));
// Resultado: 2024-12-31 23:59:59 (horário local)
```

**Quando usar:**
- Definir intervalos de datas para queries
- Filtros de período (mês, semana)
- Cálculos de data relativa

---

## Padrão de Uso: Query com Filtro de Datas

### ❌ ERRADO (Problema do Timezone)

```typescript
const inicio = startOfMonth(new Date()); // ❌ Função padrão
const fim = endOfMonth(new Date());      // ❌ Função padrão

const { data } = await supabase
  .from('transacoes')
  .select('*')
  .gte('data_vencimento', formato(inicio, 'yyyy-MM-dd')) // ❌ Formato errado
  .lte('data_vencimento', formato(fim, 'yyyy-MM-dd'));
```

**Problemas:**
1. `startOfMonth()` usa UTC internamente
2. `format(date, 'yyyy-MM-dd')` pode ter offset de timezone
3. Resultado: Filtro retorna datas do mês anterior

### ✅ CORRETO (Com Funções Locais)

```typescript
import { startOfMonthLocal, endOfMonthLocal, formatLocalDate } from '@/utils/dateUtils';

const inicio = startOfMonthLocal(new Date());
const fim = endOfMonthLocal(new Date());

const { data } = await supabase
  .from('transacoes')
  .select('*')
  .gte('data_vencimento', formatLocalDate(inicio))
  .lte('data_vencimento', formatLocalDate(fim));
```

---

## Padrão de Uso: Display de Datas

### ❌ ERRADO

```typescript
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Dados vêm como string do banco
const dataStr = '2024-12-25';
const display = format(dataStr, 'dd/MM', { locale: ptBR });
// ❌ Erro: format espera Date, não string
```

### ✅ CORRETO

```typescript
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/utils/dateUtils';

const dataStr = '2024-12-25';
const data = parseLocalDate(dataStr);
const display = format(data!, 'dd/MM', { locale: ptBR });
// Resultado: '25/12' (correto!)
```

---

## Padrão de Uso: Filtragem em Memória

Para filtros de intervalo após carregar dados (ex: dividir por data_vencimento vs data_pagamento):

```typescript
import { isWithinInterval, parseLocalDate } from 'date-fns';
import { formatLocalDate, startOfMonthLocal, endOfMonthLocal } from '@/utils/dateUtils';

// Dados vêm do Supabase
const transacoes = data.transacoes;

// Definir intervalo
const inicio = startOfMonthLocal(new Date());
const fim = endOfMonthLocal(new Date());

// Filtrar
const pendentes = transacoes.filter(t => 
  isWithinInterval(parseLocalDate(t.data_vencimento)!, {
    start: inicio,
    end: fim,
  })
);

const pagas = transacoes.filter(t =>
  isWithinInterval(parseLocalDate(t.data_pagamento)!, {
    start: inicio,
    end: fim,
  })
);
```

---

## Checklist de Implementação

Ao trabalhar com datas na aplicação, verificar:

- [ ] **Parsing strings de data?** → Use `parseLocalDate(string)`, nunca `parseISO()` ou `new Date()`
- [ ] **Formatando para enviar ao servidor?** → Use `formatLocalDate(date)` para queries/payloads
- [ ] **Filtrando por período (mês/semana)?** → Use `startOfMonthLocal()`, `endOfMonthLocal()`
- [ ] **Display de data?** → Parse com `parseLocalDate()` antes de usar `format()`
- [ ] **Intervalo de datas?** → Use `startOfMonthLocal()` + `endOfMonthLocal()` com `isWithinInterval()`
- [ ] **Query WHERE com datas?** → Use `formatLocalDate(startOfMonthLocal/endOfMonthLocal)` como valores

---

## Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| "Dezembro mostra novembro" | `parseISO()` com offset UTC | Use `parseLocalDate()` |
| Data sai errada no formato | `format(date, 'yyyy-MM-dd')` sem parse | Parse com `parseLocalDate()` primeiro |
| Filtro retorna mês anterior | `startOfMonth()` padrão | Use `startOfMonthLocal()` |
| `format()` recebe string | String não é Date | Parse com `parseLocalDate()` antes |
| Diferença de -3 horas | Conversão UTC implícita | Usar sempre funções locais |

---

## Referência Rápida

| Operação | ❌ Errado | ✅ Correto |
|----------|----------|----------|
| Parse de string | `parseISO('2024-12-25')` | `parseLocalDate('2024-12-25')` |
| Parse de string | `new Date('2024-12-25')` | `parseLocalDate('2024-12-25')` |
| Formatação para query | `format(date, 'yyyy-MM-dd')` | `formatLocalDate(date)` |
| Início do mês | `startOfMonth(date)` | `startOfMonthLocal(date)` |
| Fim do mês | `endOfMonth(date)` | `endOfMonthLocal(date)` |
| Display formatado | `format(strDate, 'dd/MM')` | `format(parseLocalDate(strDate)!, 'dd/MM')` |

---

## Contexto Técnico

### Por Que Apenas UTC-3?

A aplicação opera em um fuso único (São Paulo/Brasil). As principais razões:

1. **Simplificidade:** Sem suporte a multi-timezone do usuário
2. **Banco de dados:** Supabase armazena em UTC, mas conversão acontece no frontend
3. **Contexto:** Igreja é local (São Paulo), eventos ocorrem nesse fuso

### Quando Isso Pode Mudar

Se implementar multi-timezone no futuro:
1. Armazenar timezone do usuário em `profiles.timezone`
2. Adaptar `dateUtils` para usar `date-fns-tz`
3. Converter em load/save baseado no profile

---

## Documentação das Funções

Veja `src/utils/dateUtils.ts` para implementação detalhada e JSDoc.

```typescript
// Funções disponíveis:
export function parseLocalDate(dateString: string | null | undefined): Date | null
export function formatLocalDate(date: Date | null | undefined): string
export function startOfMonthLocal(date: Date): Date
export function endOfMonthLocal(date: Date): Date
```

---

**Última atualização:** 2026-02-10
**Versão da aplicação:** 1.0+ (com timez one fix)
**Fuso horário padrão:** UTC-3 (São Paulo)
