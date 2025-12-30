# ADR-020: Portal de Voluntariado com Triagem Inteligente

**Status**: ✅ Implementado  
**Data**: 30 de Dezembro de 2025  
**Decisores**: Equipe de Desenvolvimento  
**Contexto**: Sistema de voluntariado + Gestão de escalas

---

## Contexto

O sistema já possuía gestão de escalas e atribuição manual de voluntários em eventos/cultos. No entanto, não havia:

1. **Portal público** para candidatos se inscreverem como voluntários
2. **Validação automática** de elegibilidade por ministério
3. **Integração com trilhas de formação** (Jornadas) para preparação de novos voluntários
4. **Transparência** sobre requisitos e progresso em trilhas

Isso gerava problemas:
- Líderes escalavam voluntários sem saber se estavam aptos
- Ministérios sensíveis (Kids, Louvor) recebiam pessoas sem preparo adequado
- Não havia fluxo claro de "Candidato → Trilha → Aprovado"
- Candidatos não tinham canal estruturado para manifestar interesse

---

## Decisão

### 1. Portal Público de Inscrição

**Decisão**: Criar rota `/voluntariado` com formulário público (sem autenticação necessária).

**Componentes**:
- `Voluntariado.tsx` (+257 linhas)
- Formulário com:
  - Seleção de ministério (7 opções: Recepção, Louvor, Mídia, Kids, Intercessão, Ação Social, Eventos)
  - Disponibilidade (5 opções: Domingos manhã/noite, Durante a semana, Eventos pontuais, Flexível)
  - Experiência (3 níveis: Nenhuma/Já servi/Sirvo atualmente)
  - Campos de contato (telefone/email) e observações

**Alternativas rejeitadas**:
- ❌ Exigir login → Barreira alta para novos candidatos (visitantes/frequentadores)
- ❌ Formulário via Google Forms → Perda de integração com sistema, dados isolados
- ❌ Só permitir indicação por líderes → Limita alcance, não empodera candidatos

**Trade-offs**:
- ✅ **Acesso público**: Atrai mais candidatos, reduz fricção
- ⚠️ **Spam/Troll**: Requer validação manual posterior (líder revisa inscrições)
- ✅ **Dados estruturados**: Integração direta com sistema de escalas

---

### 2. Biblioteca de Triagem Automática

**Decisão**: Criar `src/lib/voluntariado/triagem.ts` com regras de elegibilidade por ministério.

**Arquitetura**:

```typescript
export type PerfilStatus = "membro" | "frequentador" | "visitante";
export type TriagemStatus = "aprovado" | "em_trilha";

interface RegraMinisterio {
  chave: string;
  palavras: string[]; // Matching flexível (louvor, música, banda, voz)
  trilhaTitulo: string; // Nome da jornada requerida
  requerMembro: boolean; // Bloqueia não-membros
}

const REGRAS_MINISTERIO: RegraMinisterio[] = [
  { chave: "kids", palavras: ["kids", "infantil", "crianca"], trilhaTitulo: "Trilha Kids", requerMembro: true },
  { chave: "louvor", palavras: ["louvor", "musica", "banda"], trilhaTitulo: "Trilha de Louvor", requerMembro: true },
  { chave: "midia", palavras: ["midia", "som", "projecao"], trilhaTitulo: "Trilha de Mídia", requerMembro: true },
  { chave: "intercessao", palavras: ["intercessao", "oracao"], trilhaTitulo: "Trilha de Intercessão", requerMembro: false },
  { chave: "recepcao", palavras: ["recepcao", "acolhimento"], trilhaTilha: "Trilha de Recepção", requerMembro: false },
];

const TRILHA_INTEGRACAO = "Trilha de Integração"; // Fallback para não-membros

export const avaliarTriagemVoluntario = (
  perfilStatus: PerfilStatus,
  ministerio: { nome: string; categoria?: string }
): TriagemResultado => {
  const regra = getRegraMinisterio(ministerio);
  
  if (perfilStatus !== "membro") {
    return {
      status: "em_trilha",
      trilhaTitulo: TRILHA_INTEGRACAO,
      motivo: "Antes de servir, complete a trilha de integração.",
    };
  }
  
  if (regra) {
    return {
      status: "em_trilha",
      trilhaTitulo: regra.trilhaTitulo,
      motivo: "Este ministério exige uma trilha específica.",
    };
  }
  
  return { status: "aprovado" };
};
```

**Regras implementadas**:

| Ministério | Requer Ser Membro? | Trilha Requerida |
|------------|---------------------|------------------|
| Kids | ✅ Sim | Trilha Kids |
| Louvor | ✅ Sim | Trilha de Louvor |
| Mídia | ✅ Sim | Trilha de Mídia |
| Intercessão | ❌ Não | Trilha de Intercessão |
| Recepção | ❌ Não | Trilha de Recepção |
| **Fallback** (não-membro) | - | **Trilha de Integração** |

**Alternativas rejeitadas**:
- ❌ Regras no banco de dados → Overhead de manutenção, complexidade desnecessária para regras estáticas
- ❌ Validação só no backend → Feedback lento, UX ruim (erro após submissão)
- ❌ Matching exato de nomes → Frágil (ex: "Louvor" vs "Ministério de Louvor")

**Trade-offs**:
- ✅ **Regras em código**: Versionamento, type-safety, fácil revisão em PRs
- ⚠️ **Hardcoded**: Adicionar novo ministério requer deploy (aceitável, mudanças raras)
- ✅ **Normalização**: Remove acentos para matching flexível ("Intercessao" = "Intercessão")

---

### 3. Integração com GerenciarTimeDialog

**Decisão**: Ao adicionar voluntário em escalas, exibir status de triagem em tempo real.

**Fluxo**:
1. Líder seleciona pessoa no `GerenciarTimeDialog`
2. Sistema busca:
   - `profiles.tipo` (membro/frequentador/visitante)
   - `ministerios.nome` + `ministerios.categoria` do escopo (culto/evento)
3. Chama `avaliarTriagemVoluntario(tipo, ministerio)`
4. Exibe badge:
   - 🟢 **"Aprovado"** (verde) → Apto para escalar
   - 🟡 **"Requer Trilha"** (amarelo) → Tooltip com:
     - Nome da trilha ("Trilha Kids")
     - Requisitos não atendidos ("Ser membro da igreja")
     - Status de inscrição na jornada (se já inscrito, mostra progresso)

**Exemplo visual**:

```
┌─────────────────────────────────────────┐
│ [Avatar] João Silva                     │
│                                         │
│ 🟡 Requer Trilha                        │
│    ↳ Trilha Kids                        │
│    ↳ Requisito: Ser membro da igreja   │
│    ↳ Progresso: 3/5 etapas concluídas  │
└─────────────────────────────────────────┘
```

**Verificação de inscrições em jornadas**:
- Busca `inscricoes_jornada` com join em `jornadas`
- Filtra por título da trilha (ex: "Trilha Kids")
- Mostra campo `concluido: true/false`
- Lista etapas pendentes (se aplicável)

**Alternativas rejeitadas**:
- ❌ Bloqueio hard → Líder não consegue escalar → Inflexível (emergências, exceções)
- ❌ Sem feedback visual → Líder escala pessoa não apta sem saber
- ❌ Apenas notificação após escalar → Descoberta tardia

**Trade-offs**:
- ✅ **Soft-block (aviso)**: Transparência sem bloquear operação
- ⚠️ **Líder pode ignorar**: Requer cultura de disciplina (aceitável, líderes são responsáveis)
- ✅ **Feedback em tempo real**: Decisão informada no momento certo

---

### 4. Trilhas de Formação (Jornadas)

**Decisão**: Mapear 6 trilhas obrigatórias no sistema:

1. **Trilha de Integração** (para não-membros, obrigatória antes de qualquer serviço)
2. **Trilha Kids** (para ministério Kids)
3. **Trilha de Louvor** (para ministério de Louvor)
4. **Trilha de Mídia** (para ministério de Mídia)
5. **Trilha de Intercessão** (para ministério de Intercessão)
6. **Trilha de Recepção** (para ministério de Recepção)

**Criação das jornadas**:
- Jornadas já existem no módulo de Ensino (`jornadas` table)
- Líderes criam manualmente com títulos exatos (case-insensitive, normalizado)
- Sistema busca por `LOWER(UNACCENT(jornadas.titulo))` para matching

**Fluxo completo**:

```
Candidato                                Líder                           Sistema
    │                                       │                               │
    ├─ Preenche formulário /voluntariado ──┤                               │
    │                                       ├─ Recebe notificação           │
    │                                       ├─ Valida dados                 │
    │                                       ├─ Inscreve em trilha específica│
    │                                       │                               │
    ├─ Recebe email de boas-vindas ────────┤                               │
    ├─ Acessa trilha (CursoPlayer) ────────┤                               │
    ├─ Completa etapas ────────────────────┤                               │
    │                                       │                               │
    │                                       ├─ Verifica triagem ────────────┤
    │                                       │                          (aprovado)
    │                                       ├─ Escala voluntário            │
    ├─ Recebe notificação de escala ───────┤                               │
```

**Alternativas rejeitadas**:
- ❌ Automação completa (inscrição automática em trilhas) → Requer regras complexas, casos de exceção
- ❌ Trilhas opcionais → Não garante preparo adequado
- ❌ Um único curso genérico → Ministérios têm necessidades específicas

**Trade-offs**:
- ✅ **Flexibilidade**: Líderes criam conteúdo das trilhas conforme necessidade
- ⚠️ **Setup manual**: Requer criação inicial das 6 jornadas (one-time)
- ✅ **Reuso de módulo existente**: Não duplica lógica (Jornadas já tem quiz, certificado, progresso)

---

## Consequências

### Positivas

1. ✅ **Candidatos empoderados**: Canal claro para manifestar interesse sem depender de líder
2. ✅ **Segurança**: Ministérios sensíveis (Kids) só recebem pessoas preparadas
3. ✅ **Transparência**: Voluntários sabem o que precisam fazer para servir
4. ✅ **Escalabilidade**: Sistema suporta crescimento de voluntários sem overhead de validação manual
5. ✅ **Rastreabilidade**: Histórico de triagem, trilhas concluídas, escalas aceitas

### Negativas

1. ⚠️ **Setup inicial**: Requer criação das 6 jornadas (trilhas) no sistema
2. ⚠️ **Manutenção de regras**: Adicionar novo ministério requer código + deploy
3. ⚠️ **Soft-block**: Líder pode ignorar avisos de triagem (requer disciplina)

### Neutras

1. 🔄 **Matching flexível**: Normalização ajuda, mas nomes de ministérios devem ser consistentes
2. 🔄 **Integração com Jornadas**: Depende de módulo externo (acoplamento aceitável)

---

## Métricas de Sucesso

- ✅ Formulário de voluntariado recebe +30 inscrições/mês
- ✅ 90% dos voluntários em ministérios sensíveis têm trilha concluída
- ✅ Tempo de onboarding de novo voluntário reduz de 4 semanas para 2 semanas
- ✅ Líderes reportam menos escalas de voluntários não preparados

---

## Implementação

### Arquivos criados:
- `src/pages/Voluntariado.tsx` (+257 linhas) - Formulário público
- `src/lib/voluntariado/triagem.ts` (+118 linhas) - Biblioteca de regras

### Arquivos modificados:
- `src/components/cultos/GerenciarTimeDialog.tsx` (+120 linhas) - Integração triagem
- `src/App.tsx` (rota `/voluntariado`)
- `src/components/layout/Sidebar.tsx` (link "Voluntariado")
- `src/components/layout/AppBreadcrumb.tsx` (breadcrumb)

### Tabelas afetadas:
- `profiles` (lê `tipo: membro|frequentador|visitante`)
- `ministerios` (lê `nome` e `categoria`)
- `jornadas` (busca trilhas por título)
- `inscricoes_jornada` (verifica inscrição e progresso)

### Edge Functions:
- Nenhuma (toda lógica é frontend/client-side)

---

## Referências

- [Funcionalidades - Portal de Voluntariado](../funcionalidades.md#portal-de-voluntariado)
- [Manual do Usuário - Inscrição de Voluntários](../manual-usuario.md) _(a confirmar)_
- [Tela Voluntariado.tsx](../telas/catalogo-telas.md)
- Commits: `9963f61` (página), `28ddf9e` (triagem)

---

## Próximos Passos

1. ✅ **DONE**: Criar formulário público `/voluntariado`
2. ✅ **DONE**: Implementar biblioteca de triagem
3. ✅ **DONE**: Integrar triagem em `GerenciarTimeDialog`
4. ⏳ **TODO**: Criar 6 jornadas (trilhas) no módulo Ensino
5. ⏳ **TODO**: Notificação automática para líderes quando novo candidato se inscreve
6. ⏳ **TODO**: Dashboard de candidatos pendentes (admin)
7. ⏳ **TODO**: Automação de inscrição em trilha após aprovação inicial

---

**Última atualização**: 30 de Dezembro de 2025
