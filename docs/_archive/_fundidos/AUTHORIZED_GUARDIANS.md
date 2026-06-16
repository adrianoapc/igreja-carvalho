# Funcionalidade de Responsáveis/Autorizados

## 📋 Objetivo
Permitir que o usuário principal (ex: Pai/Mãe) autorize outras pessoas (ex: Avó, Tia) a visualizar e fazer check-in das crianças na plataforma.

## 🎯 Fluxo de Funcionamento

### 1. **Adicionar Responsável/Autorizado**

Acesse o ícone de usuários no header da `FamilyWallet` para abrir o diálogo de vinculação.

#### Passo 1: Buscar Pessoa
- Digite o **e-mail** ou **telefone** da pessoa que deseja autorizar
- Você pode buscar qualquer pessoa já cadastrada no sistema
- O sistema faz busca em tempo real (após 2 caracteres)

#### Passo 2: Confirmar Parentesco
- Selecione o tipo de relacionamento com a família
- Opções disponíveis:
  - Avó / Avô (Paterno/Materno)
  - Tio / Tia
  - Padrasto / Madrasta
  - Prima / Primo
  - Irmã / Irmão (adulto)
  - Outro

#### Passo 3: Selecionar Crianças
- Escolha quais crianças essa pessoa pode buscar
- Apenas crianças menores de 13 anos aparecem nesta lista
- Você pode selecionar múltiplas crianças

#### Passo 4: Salvar
- Clique em "Vincular" para confirmar
- Um vínculo será criado na tabela `familias` com:
  - `pessoa_id`: ID da pessoa autorizada (ex: Avó)
  - `familiar_id`: ID de cada criança selecionada
  - `tipo_parentesco`: O relacionamento informado

### 2. **Visualizar Responsáveis Autorizados**

A seção **"Quem Pode Buscar"** lista todas as pessoas que têm acesso às suas crianças:

- ✅ Nome completo
- ✅ Tipo de parentesco (Avó, Tio, etc.)
- ✅ E-mail ou telefone
- ✅ Opções de ação (remover acesso)

### 3. **Remover Responsável**

Clique no menu (⋮) de um responsável e selecione **"Remover Acesso"**:

- A confirmação será solicitada
- Todos os vínculos da pessoa com as crianças serão deletados
- A pessoa deixará de ter acesso ao Kids

## 🗄️ Estrutura de Dados

### Tabela: `familias`

```sql
-- Novo vínculo: Avó tem acesso à Criança
INSERT INTO familias (pessoa_id, familiar_id, tipo_parentesco)
VALUES (
  'uuid-da-avó',
  'uuid-da-criança',
  'avo'
);
```

## 🔒 Segurança (RLS)

- ✅ Um usuário só pode ver suas próprias crianças
- ✅ Apenas relacionamentos válidos podem ser criados
- ✅ A remoção é feita pelo responsável legal principal

## 📱 Fluxo na Perspectiva da Avó

Quando a **Avó** (pessoa autorizada) abre a `FamilyWallet`:

1. Na seção **"Minha Família"**, as crianças aparecerão automaticamente
2. O vínculo bidirecional é consultado na tabela `familias`
3. As crianças aparecem com parentesco exibido como: **"Neto(a)"** (inverso de "Avó")
4. O **QR Code** da Avó funciona normalmente no scanner do Kids
5. Ela pode fazer check-in e checkout das crianças

## 🔄 Queries Bidirecionais

O sistema busca relacionamentos nos dois sentidos:

```typescript
// Query 1: Pessoas que EU adicionei como responsáveis
const relationshipsAsPessoa = await supabase
  .from('familias')
  .select('pessoa_id, familiar_id, tipo_parentesco')
  .eq('pessoa_id', meuId);

// Query 2: Pessoas que me adicionaram como responsável (reverso)
const relationshipsAsFamiliar = await supabase
  .from('familias')
  .select('pessoa_id, familiar_id, tipo_parentesco')
  .eq('familiar_id', meuId);

// Combinar ambas e exibir com inversão de papel
```

## 📊 Casos de Uso

### Caso 1: Pai autoriza Avó
```
Pai (pessoa_id) → Avó (familiar_id) para Filho (criança)
Login da Avó: Vê "Neto(a)" como tipo_parentesco
```

### Caso 2: Pai autoriza Tio e Tia
```
Pai (pessoa_id) → Tio (familiar_id) para Filho (criança)
Pai (pessoa_id) → Tia (familiar_id) para Filho (criança)
```

### Caso 3: Mãe remove acesso da Avó
```
DELETE FROM familias WHERE pessoa_id = 'uuid-avó' AND familiar_id = 'uuid-filho'
```

## ✅ Checklist de Implementação

- [x] Criar componente `VincularResponsavelDialog.tsx`
- [x] Implementar fluxo de 3 passos (search → confirm → select-kids)
- [x] Integrar dialog na `FamilyWallet.tsx`
- [x] Adicionar seção "Quem Pode Buscar"
- [x] Implementar remoção de responsáveis
- [x] Usar queries bidirecionais corretas
- [x] Adicionar botão no header para gerenciar responsáveis
- [x] Validar seleção obrigatória de crianças
- [x] Testar fluxo completo

## 🚀 Próximas Melhorias

1. **Notificação**: Avisar quando alguém for adicionado como responsável
2. **Histórico**: Rastrear quando relacionamentos foram criados/alterados
3. **Validação Cruzada**: Avisar se há conflito de parentesco
4. **Permissões Granulares**: Permitir diferentes níveis de acesso (visualizar apenas vs. fazer check-in)
5. **QR Code Compartilhado**: QR code único para guardiões

## 📝 Notas Técnicas

- O relacionamento é unidirecional na tabela (sempre `pessoa_id` → `familiar_id`)
- O reverso é determinado em tempo de query (qual lado você está)
- A inversão de labels é feita com a função `getDisplayRole()`
- Cache React Query é invalidado após mudanças
