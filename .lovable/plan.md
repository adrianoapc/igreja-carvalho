

# Adicionar Botão de Cadastro Rápido na Página Pessoas

## Problema

Atualmente, para cadastrar uma pessoa pelo painel administrativo:
- **Visitantes/Frequentadores**: É preciso ir em Pessoas → Visitantes → Registrar
- **Membros**: Não existe fluxo direto - apenas o card de "Links Externos" para auto-cadastro

Isso torna o processo pouco intuitivo para a secretaria/liderança que precisa cadastrar pessoas manualmente.

---

## Proposta de Solução

### Opção Implementada

Adicionar um **botão CTA principal** no dashboard de Pessoas que abre um fluxo de cadastro com seleção do tipo de pessoa:

```text
┌──────────────────────────────────────────────────────────────┐
│  Pessoas                                                      │
│  Dashboard centralizado de gestão de pessoas                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔍 Buscar pessoa por nome, email ou telefone...        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [+ Cadastrar Pessoa]  ← NOVO BOTÃO PRINCIPAL                 │
│                                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│  │  Total  │ │Visitant.│ │ Frequen.│ │ Membros │             │
│  │  120    │ │   45    │ │   35    │ │   40    │             │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
└──────────────────────────────────────────────────────────────┘
```

### Modal de Cadastro Unificado

Ao clicar em "+ Cadastrar Pessoa", abre um modal com:

1. **Seleção do tipo** (visitante, frequentador, membro)
2. **Formulário adaptável** baseado no tipo selecionado:
   - Visitante/Frequentador: Formulário simplificado (nome, contato, origem)
   - Membro: Formulário mais completo (dados pessoais, endereço, dados eclesiásticos)

---

## Detalhes da Implementação

### 1. Modificar página `src/pages/pessoas/index.tsx`

Adicionar botão "+ Cadastrar Pessoa" no header, logo após a barra de busca:

```tsx
<Button
  className="bg-gradient-primary shadow-soft"
  onClick={() => setCadastrarOpen(true)}
>
  <UserPlus className="w-4 h-4 mr-2" />
  Cadastrar Pessoa
</Button>
```

### 2. Criar componente `CadastrarPessoaDialog.tsx`

Modal com duas etapas:

**Etapa 1 - Seleção do Tipo:**
```text
┌────────────────────────────────────────┐
│  Cadastrar Nova Pessoa                 │
├────────────────────────────────────────┤
│  Que tipo de pessoa você quer          │
│  cadastrar?                            │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 👤 Visitante                    │   │
│  │ Primeira vez na igreja          │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🔄 Frequentador                 │   │
│  │ Já frequenta regularmente       │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ ⭐ Membro                       │   │
│  │ Membro oficial da igreja        │   │
│  └────────────────────────────────┘   │
│                                        │
│  [Cancelar]                            │
└────────────────────────────────────────┘
```

**Etapa 2 - Formulário:**
- Reutiliza lógica do `RegistrarVisitanteDialog` para visitantes/frequentadores
- Formulário expandido para membros (mais campos)

### 3. Fluxo de Dados

| Tipo | Campos Principais | Status no DB |
|------|-------------------|--------------|
| Visitante | Nome, contato, origem | `visitante` |
| Frequentador | Nome, contato, origem | `frequentador` |
| Membro | Nome, contato, dados pessoais, dados igreja | `membro` |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/pessoas/CadastrarPessoaDialog.tsx` | **Criar** - Modal unificado de cadastro |
| `src/pages/pessoas/index.tsx` | Modificar - Adicionar botão e integrar modal |

---

## Benefícios

1. **Acesso Direto**: Secretária não precisa navegar por subpáginas
2. **Fluxo Unificado**: Um único ponto de entrada para todos os tipos
3. **Consistência**: Mesma experiência de cadastro em todo o sistema
4. **Reutilização**: Aproveita validações existentes do `RegistrarVisitanteDialog`

---

## Resultado Visual Esperado

O dashboard de Pessoas terá um botão proeminente no topo, ao lado da busca ou logo abaixo do título, permitindo cadastro rápido de qualquer tipo de pessoa com um clique.

