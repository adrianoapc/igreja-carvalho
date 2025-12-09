# 🔗 Relacionamentos Bidirecionais - FamilyWallet

## Problema Resolvido

Anteriormente, a FamilyWallet só mostrava as pessoas que **EU cadastrei**. Se alguém me adicionava como familiar, essa relação era invisível para mim.

**Exemplo do gap:**
- João adiciona Maria como "filha"
- Maria não via João em sua lista de familiares
- Maria precisaria cadastrar João manualmente como "pai"

## Solução: Busca Bidirecional

A query agora busca os **dois lados** da relação na tabela `familias`:

```sql
SELECT * FROM familias
WHERE pessoa_id = meu_id OR familiar_id = meu_id
```

### Fluxos Implementados

#### 1️⃣ **Fluxo Normal** (pessoa_id = eu)
```
Eu cadastro: "Adiciono João como Pai"
├─ pessoa_id = meu_id
├─ familiar_id = id_de_joao
├─ tipo_parentesco = "pai"
└─ Exibição: João | Pai
```

#### 2️⃣ **Fluxo Reverso** (familiar_id = eu)
```
João me adiciona: "Adiciono Maria como Filha"
├─ pessoa_id = id_de_joao
├─ familiar_id = meu_id
├─ tipo_parentesco = "filha"
└─ Problema: Eu vejo "filha"? ❌ Deveria ser "Pai"! ✅
```

## Lógica de Inversão de Papel

A função `getDisplayRole()` mapeia o papel de parentesco baseado:
1. **Se é fluxo normal** (`isReverse = false`): Retorna exatamente como foi cadastrado
2. **Se é fluxo reverso** (`isReverse = true`): Inverte a lógica

### Tabela de Inversão

| Papel Armazenado | Fluxo Normal | Fluxo Reverso | Sexo |
|---|---|---|---|
| `pai` | Pai | Filho | M |
| `pai` | Pai | Filha | F |
| `mãe` | Mãe | Filho | M |
| `mãe` | Mãe | Filha | F |
| `filho` | Filho | Responsável | - |
| `filha` | Filha | Responsável | - |
| `marido` | Marido | Cônjuge | - |
| `esposa` | Esposa | Cônjuge | - |
| `cônjuge` | Cônjuge | Cônjuge | - |
| Outros | [Como está] | Familiar | - |

### Exemplos Práticos

#### Caso 1: João adiciona Maria como Filha

```
Banco:
├─ pessoa_id = joao_id
├─ familiar_id = maria_id
└─ tipo_parentesco = "filha"

Para Maria:
├─ isReverse = true (porque familiar_id === maria_id)
├─ storedRole = "filha"
├─ getDisplayRole("filha", true, "F") → "Responsável"
└─ Exibição: João | Responsável ✅
```

#### Caso 2: Maria adiciona seu marido Carlos

```
Banco:
├─ pessoa_id = maria_id
├─ familiar_id = carlos_id
└─ tipo_parentesco = "marido"

Para Maria:
├─ isReverse = false
├─ storedRole = "marido"
├─ getDisplayRole("marido", false, "M") → "marido"
└─ Exibição: Carlos | Marido ✅

Para Carlos (se ele pesquisar):
├─ isReverse = true
├─ storedRole = "marido"
├─ getDisplayRole("marido", true, null) → "Cônjuge"
└─ Exibição: Maria | Cônjuge ✅
```

## Implementação Técnica

### 1. Query Abrangente

```typescript
const { data: relationships } = await supabase
  .from('familias')
  .select('id, pessoa_id, familiar_id, tipo_parentesco')
  .or(`pessoa_id.eq.${profile.id},familiar_id.eq.${profile.id}`);
  // ^^ Busca os DOIS lados da relação
```

### 2. Identificação Inteligente do Alvo

```typescript
relationships.forEach(item => {
  let targetId: string;
  let isReverse = false;

  if (item.pessoa_id === profile.id) {
    // EU sou pessoa_id → o outro é familiar_id
    targetId = item.familiar_id;
    isReverse = false;
  } else {
    // EU sou familiar_id → o outro é pessoa_id
    targetId = item.pessoa_id;
    isReverse = true;
  }
  
  familiarMap.set(targetId, {
    familiarId: targetId,
    storedRole: item.tipo_parentesco,
    isReverse,
  });
});
```

### 3. Busca de Dados

```typescript
const { data: familiarProfiles } = await supabase
  .from('profiles')
  .select('id, nome, data_nascimento, avatar_url, alergias, sexo, responsavel_legal, status')
  .in('id', Array.from(familiarIds));
```

### 4. Montagem Final com Inversão

```typescript
return Array.from(familiarIds)
  .filter(id => profileMap.has(id))
  .map(id => {
    const familiar = profileMap.get(id)!;
    const relationData = familiarMap.get(id)!;

    const displayRole = getDisplayRole(
      relationData.storedRole,
      relationData.isReverse,
      familiar.sexo
    );

    return {
      id: familiar.id,
      nome: familiar.nome,
      // ... outros campos
      tipo_parentesco: displayRole,
      _isReverse: relationData.isReverse,
    };
  });
```

## Função de Inversão de Papel

```typescript
function getDisplayRole(
  storedRole: string | null | undefined,
  isReverse: boolean,
  memberSex?: string | null
): string {
  if (!storedRole) return "Familiar";
  if (!isReverse) return storedRole;

  const role = storedRole.toLowerCase();

  // Cônjuges mantêm "Cônjuge"
  if (["marido", "esposa", "cônjuge"].includes(role)) {
    return "Cônjuge";
  }

  // Pai/Mãe → Filho/Filha
  if (role === "pai" || role === "mãe") {
    return memberSex === "M" ? "Filho" : "Filha";
  }

  // Filho/Filha → Responsável
  if (role === "filho" || role === "filha") {
    return "Responsável";
  }

  return "Familiar";
}
```

## Benefícios

✅ **Visibilidade Completa**: Vejo tanto quem eu cadastrei quanto quem me adicionou

✅ **Semântica Correta**: O papel mostrado faz sentido do meu ponto de vista

✅ **Dinâmico**: Se alguém me adiciona, não preciso fazer nada - aparece automaticamente

✅ **Reversível**: Se vejo João como "Pai", João me vê como "Filho/Filha"

✅ **Sem Duplicatas**: Mesmo que haja relação bidirecionalmente registrada, não duplica na lista

## Testes Sugeridos

### Teste 1: Bidirecionalidade Pai-Filho

1. **João** cadastra **Maria** como "Filha"
2. Verificar lista de João: Maria | Filha ✅
3. Verificar lista de Maria: João | Responsável ✅

### Teste 2: Matrimônio

1. **Maria** cadastra **Carlos** como "Marido"
2. Verificar lista de Maria: Carlos | Marido ✅
3. Verificar lista de Carlos: Maria | Cônjuge ✅

### Teste 3: Relação Dupla

1. **João** cadastra **Maria** como "Filha"
2. **Maria** cadastra **João** como "Pai" (relação reversa duplicada)
3. Resultado esperado: João aparece UMA VEZ | Responsável ✅

## Performance

- **Queries**: 2 queries (relacionamentos + perfis)
- **Índices úteis**:
  ```sql
  CREATE INDEX idx_familias_pessoa_id ON familias(pessoa_id);
  CREATE INDEX idx_familias_familiar_id ON familias(familiar_id);
  ```
- **Caching**: React Query com `queryKey: ['family-members', profile?.id]`
- **Atualização**: A cada 5min ou ao adicionar novo membro

## Possíveis Extensões

1. **Filtro por tipo**: Mostrar apenas "Responsáveis", "Cônjuges", etc.
2. **Validação cruzada**: Avisar se há conflito (João diz que é Pai, Maria diz que é Primo)
3. **Histórico**: Rastrear quando relações foram adicionadas/alteradas
4. **Notificação**: Avisar quando alguém te adiciona como familiar
