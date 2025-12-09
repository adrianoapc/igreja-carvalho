# 🤝 Módulo Kids - Inclusão e Gestão de Responsáveis

## 📋 Funcionalidades de Inclusão

### 1. Campo "Necessidades Especiais"

Todos os formulários agora incluem um campo dedicado para cadastrar necessidades especiais das crianças.

#### 📝 Campos Disponíveis:

**No AdicionarDependenteDrawer.tsx:**
- ✅ Textarea para "Necessidades Especiais (Inclusão)"
- ✅ Ícone: `HeartHandshake` (cor azul)
- ✅ Placeholder: "Ex: Deficiência visual, TDAH, transtorno do espectro autista..."
- ✅ Campo é opcional (não obrigatório)
- ✅ Inserido no banco junto com alergias e outros dados

**No EditarDependenteDrawer.tsx:**
- ✅ Textarea para editar "Necessidades Especiais"
- ✅ Ícone: `HeartHandshake` (cor azul)
- ✅ Campo é opcional
- ✅ Atualizado no banco de dados

### 2. Visual e Ícones

#### Cores e Ícones:

| Campo | Ícone | Cor | Significado |
|-------|-------|-----|------------|
| Alergias | ⚠️ AlertTriangle | Vermelho/Destructive | Alerta de saúde |
| Inclusão | 🤝 HeartHandshake | Azul | Necessidades especiais |

#### No KidCard:

```tsx
// Badge compacto
<div className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded">
  <HeartHandshake className="w-3 h-3 text-blue-700" />
  <span className="font-medium text-blue-700">Inclusão</span>
</div>

// Seção expandida ao clicar em "Ver Detalhes"
<div className="space-y-1">
  <p className="font-medium text-blue-700 flex items-center gap-1">
    <HeartHandshake className="w-3 h-3" />
    Necessidades Especiais (Inclusão)
  </p>
  <p className="text-muted-foreground bg-blue-50 p-1.5 rounded">
    {necessidades_especiais}
  </p>
</div>
```

### 3. Exemplos de Necessidades Especiais

O sistema pode registrar:

- 👓 Deficiência visual
- 👂 Deficiência auditiva
- 🚶 Deficiência motora
- 🧠 Transtorno do espectro autista (TEA)
- 🎯 TDAH (Transtorno do Déficit de Atenção e Hiperatividade)
- 📚 Dislexia
- 🗣️ Atraso na fala
- 💪 Síndrome de Down
- 🔊 Selecismo mutista
- ⚕️ Alergias severas (registrar aqui também)
- 🧑‍🦽 Mobilidade reduzida
- 💊 Condições crônicas especiais
- 🫀 Problemas cardíacos
- 🫁 Problemas respiratórios

### 4. Fluxo de Cadastro

#### Ao Adicionar uma Criança:

```
1. Upload de foto (opcional)
2. Tipo de parentesco
3. Nome completo ✓ (obrigatório)
4. Data de nascimento ✓ (obrigatório)
5. Gênero (opcional)
6. ⚠️ Alergias / Restrições (opcional)
7. 🤝 Necessidades Especiais (opcional)  ← NOVO
8. Salvar
```

#### Ao Editar uma Criança:

```
1. Upload de foto
2. ⚠️ Alergias / Restrições (editável)
3. 🤝 Necessidades Especiais (editável)  ← NOVO
4. Salvar Alterações
```

### 5. Visualização na FamilyWallet

**Seção de Minha Família:**

```
┌─────────────────────────────────────┐
│ [Avatar]  João                      │
│           Filho · 3 anos            │
│                                     │
│ ⚠️ Alergia   🤝 Inclusão           │
│                                     │
│ Ver Responsáveis                    │
└─────────────────────────────────────┘
```

Ao expandir:
```
⚠️ Alergias
   Alergia a amendoim, lactose

🤝 Necessidades Especiais (Inclusão)
   TDAH leve, necessita de mais atenção
   durante as atividades

Responsáveis
   João Silva (Pai) - (11) 98765-4321
   Maria Santos (Avó) - (11) 91234-5678
```

### 6. Exibição na Página de Crianças (Criancas.tsx)

No diretório de crianças, cada card mostra:

```
┌─────────────────────────────────┐
│ [Avatar]  Maria                 │
│          3 anos                 │
│                                 │
│ ⚠️ Alergia  🤝 Inclusão        │
│                                 │
│ Ver Detalhes                    │
└─────────────────────────────────┘
```

### 7. Estrutura de Dados

#### Tabela `profiles`:

```sql
-- Coluna já existente no banco
ALTER TABLE profiles 
ADD COLUMN necessidades_especiais TEXT;

-- Exemplo de dados
INSERT INTO profiles (
  id, nome, data_nascimento,
  alergias,
  necessidades_especiais,
  status
) VALUES (
  'uuid-123',
  'João Silva',
  '2022-05-15',
  'Alergia a amendoim',
  'TDAH, necessita rotina bem estruturada',
  'membro'
);
```

### 8. Integração com Responsáveis

Quando um responsável é adicionado (ex: Avó), ele pode ver:

```
✅ Nome da criança
✅ Idade
✅ ⚠️ Alergias
✅ 🤝 Necessidades Especiais (Inclusão)
✅ Quem são os outros responsáveis
```

Isso garante que todos os cuidadores estejam alinhados sobre as necessidades da criança.

### 9. Casos de Uso

#### Caso 1: Criança com TDAH

```
Nome: Lucas
Idade: 5 anos
Alergias: Nenhuma
Necessidades Especiais: "TDAH diagnosticado, precisa de mais 
                         movimento, atividades curtas e objetivas"
Responsáveis: Maria (Mãe), João (Pai), Ana (Tia)

→ Todos os responsáveis veem a informação
→ Os cuidadores do Kids ajustam atividades
```

#### Caso 2: Criança com Deficiência Visual

```
Nome: Sofia
Idade: 4 anos
Alergias: Lactose
Necessidades Especiais: "Deficiência visual parcial (míope),
                         necessita de letras grandes e muito contraste"
Responsáveis: Pedro (Pai), Carla (Mãe)

→ Material do Kids em alto contraste
→ Fonte ampliada para Sofia
→ Responsáveis alertados sobre cuidados
```

#### Caso 3: Criança com Síndrome de Down

```
Nome: Felipe
Idade: 6 anos
Alergias: "Alergia a corantes artificiais"
Necessidades Especiais: "Síndrome de Down, acompanhamento 
                         psicopedagógico em andamento,
                         atividades lúdicas adaptadas"
Responsáveis: Todos da família podem ver e colaborar
```

### 10. Benefícios da Implementação

✅ **Inclusão Real:** Crianças com necessidades especiais são valorizadas
✅ **Segurança:** Todos os cuidadores estão alinhados
✅ **Acessibilidade:** Sistema preparado para diferentes necessidades
✅ **Documentação:** Histórico atualizado de necessidades
✅ **Colaboração:** Pais e responsáveis trabalham juntos
✅ **Sensibilidade:** Linguagem acolhedora e respeitosa

### 11. Próximas Melhorias

- [ ] Acessibilidade: Interface com suporte a leitores de tela
- [ ] Atividades Adaptadas: Marcar atividades como "adaptadas para X"
- [ ] Histórico: Registro de mudanças nas necessidades
- [ ] Notificações: Alertar quando necessidades especiais mudam
- [ ] Integração com Fonoaudiologia/Psicopedagogia
- [ ] Sinalização: Badges visuais no kids com as necessidades
- [ ] Integração com especialistas (se necessário)

---

**Implementação Realizada em:** 9 de dezembro de 2025
**Status:** ✅ Concluído
**Arquivos Modificados:** 4
- `AdicionarDependenteDrawer.tsx`
- `EditarDependenteDrawer.tsx`
- `FamilyWallet.tsx`
- `KidCard.tsx`
