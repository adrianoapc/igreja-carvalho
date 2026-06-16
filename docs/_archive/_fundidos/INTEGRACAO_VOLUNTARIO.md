# 📋 Fluxo de Integração de Voluntários - Documentação Técnica

## 1️⃣ Visão Geral

O fluxo de integração converte um **candidato aprovado** em um **membro ativo** do ministério através de 5 estágios:

```
APROVADO → ENTREVISTA → TRILHA → MENTORIA → TESTE → ATIVO
```

---

## 2️⃣ Estágios Detalhados

### **Estágio 1: ENTREVISTA** (1-3 dias)
- Admin/Líder agenda entrevista com candidato
- Objetivo: confirmar disponibilidade, esclarecer expectativas
- **Ação final**: Aprova ou rejeita candidato
- **Transição**: Entrada em TRILHA com data_conclusao_esperada = hoje + 15 dias após conclusão da jornada

### **Estágio 2: TRILHA** (30-45 dias típico)
- Candidato inscrito automaticamente na `jornadas` do ministério
- Rastreia progresso: `percentual_jornada` (0-100%)
- Mentor acompanha progresso
- **Ação final**: Sistema atualiza percentual_jornada quando candidato conclui
- **Transição automática**: Ao atingir 100%, avança para MENTORIA (data_conclusao_esperada = data_conclusão + 15 dias)

### **Estágio 3: MENTORIA** (15 dias)
- Mentor acompanha candidato na prática
- Check-ins semanais
- Observação em ação real
- **Ação final**: Mentor marca como pronto para teste
- **Transição**: Avança para TESTE

### **Estágio 4: TESTE** (1-7 dias)
- Candidato faz teste/audição do ministério
- Tipo varia: prático, escrito, entrevista ou híbrido
- Sistema registra resultado em `resultados_teste`
- **Ação final**: Aprovado/Reprovado
  - ✅ Aprovado → ATIVO (membro adicionado a `membros_time`)
  - ❌ Reprovado → pode tentar novamente em 30 dias ou ser rejeitado

### **Estágio 5: ATIVO** ✅
- Membro incluído em `membros_time`
- Elegível para escalas
- Acompanhamento de 30/60/90 dias

---

## 3️⃣ Estrutura de Dados

### **Tabela: `integracao_voluntario`**
```typescript
{
  id: UUID,
  candidato_id: UUID → candidatos_voluntario,
  mentor_id: UUID → profiles (líder, sublíder ou membro sênior),
  jornada_id: UUID → jornadas,
  
  status: 'entrevista' | 'trilha' | 'mentoria' | 'teste' | 'ativo' | 'rejeitado',
  
  // Jornada
  percentual_jornada: 0-100,
  data_jornada_iniciada: timestamp,
  data_jornada_concluida: timestamp,
  data_conclusao_esperada: timestamp, // jornada_fim + 15 dias
  
  // Teste
  teste_id: UUID → testes_ministerio,
  data_teste_agendada: timestamp,
  resultado_teste: 'aprovado' | 'reprovado' | 'pendente',
  pontuacao_teste: number,
  data_resultado_teste: timestamp,
  
  created_at, updated_at
}
```

### **Tabela: `testes_ministerio`**
```typescript
{
  id: UUID,
  time_id: UUID → times (ministério),
  
  titulo: string, // Ex: "Audição Louvor"
  descricao: string,
  tipo: 'pratico' | 'escrito' | 'entrevista' | 'hibrido',
  
  // Conteúdo flexível em JSON
  conteudo_json: {
    perguntas: [
      { id: "1", pergunta: "...", tipo: "texto|multipla|sim_nao", peso: 10 }
    ],
    criterios: [
      { id: "1", nome: "Habilidade X", descricao: "...", peso: 25 }
    ],
    duracao_minutos: 30,
    pontuacao_minima_aprovacao: 70
  },
  
  pontuacao_minima_aprovacao: 70, // default
  ativo: boolean,
  
  created_by: UUID → profiles,
  created_at, updated_at
}
```

### **Tabela: `resultados_teste`**
```typescript
{
  id: UUID,
  integracao_id: UUID → integracao_voluntario,
  teste_id: UUID → testes_ministerio,
  candidato_id: UUID → candidatos_voluntario,
  
  // Resposta em JSON
  resposta_json: {
    respostas: [
      { pergunta_id: "1", resposta: "..." }
    ],
    avaliacoes_criterios: [
      { criterio_id: "1", pontuacao: 8, feedback: "..." }
    ]
  },
  
  pontuacao_total: number,
  resultado: 'aprovado' | 'reprovado',
  feedback: string,
  
  avaliado_por: UUID → profiles (mentor/admin),
  created_at, updated_at
}
```

---

## 4️⃣ Fluxos de Notificação

### **WhatsApp**
- ✅ **Aprovado**: "Parabéns! Você foi aprovado. Iniciando trilha de formação..."
- ✅ **Jornada iniciada**: "Sua trilha começou. Acesse: [link]"
- ✅ **Mentor designado**: "Seu mentor é [nome]. Vamos se conhecer?"
- ✅ **Teste agendado**: "Seu teste de aptidão está marcado para [data/hora]"
- ✅ **Resultado teste**: "Resultado: Aprovado! ✅" ou "Será que próxima tentativa?"

### **In-App**
- Card no dashboard mostrando progresso
- Badge "Em Integração" ou "Teste Pendente"
- Notificação quando mentor comenta/avalia

---

## 5️⃣ Implementação Sugerida - Prioridade

### **Fase 1 (Esta semana)** - MVP
- ✅ Migrations SQL (FEITO)
- 🔲 Admin: criar testes por ministério (Passo 6)
- 🔲 Admin: dashboard integracao_voluntario (Passo 5)
- 🔲 Notificações WhatsApp básicas (Passo 8)

### **Fase 2 (Próxima semana)** 
- 🔲 UI para candidato fazer teste (Passo 7)
- 🔲 Dashboard pessoal candidato (Passo 10)
- 🔲 Notificações in-app (Passo 9)

### **Fase 3 (Opcional)**
- Gamificação (badges, pontos)
- Relatórios avançados
- Integração com calendário

---

## 6️⃣ Exemplo: Fluxo Prático

### **Dia 1 - Candidato é Aprovado**
```
1. Admin aprova candidato em /voluntario/gestao
2. Sistema cria registro em integracao_voluntario (status: 'entrevista')
3. WhatsApp: "Parabéns! Você foi aprovado para [ministério]"
4. Admin agenda entrevista
```

### **Dia 2-3 - Entrevista Realizada**
```
1. Admin marca candidato como pronto
2. Sistema designa mentor (líder/sublíder/sênior do ministério)
3. Sistema inscreve candidato em jornada relevante
4. Status muda para 'trilha'
5. data_conclusao_esperada = data_conclusão_jornada + 15 dias
6. WhatsApp: "Sua trilha começou! Seu mentor é [nome]"
```

### **Dia 30 - Candidato Conclui Jornada**
```
1. Sistema detecta percentual_jornada = 100%
2. Status muda para 'mentoria'
3. data_conclusao_esperada = hoje + 15 dias
4. WhatsApp: "Trilha concluída! Iniciando fase de mentoria"
```

### **Dia 45 - Mentor Marca Pronto para Teste**
```
1. Mentor visualiza candidato em dashboard
2. Clica "Marcar pronto para teste"
3. Status muda para 'teste'
4. Se teste existe, agenda automaticamente
5. WhatsApp: "Seu teste está marcado para [data]"
```

### **Dia 47 - Candidato Faz Teste**
```
1. Candidato acessa /voluntariado/meu-teste
2. Faz teste (pratico, escrito ou entrevista)
3. Resposta salva em resultados_teste
4. Mentor revisa (pode ser automático se test escrito)
5. Resultado publicado
6. Se aprovado: membro adicionado a membros_time
7. WhatsApp: "Parabéns! Você é oficialmente membro!"
```

---

## 7️⃣ SQL de Exemplo - Criar Teste para Louvor

```sql
INSERT INTO testes_ministerio (
  time_id, 
  titulo, 
  descricao, 
  tipo, 
  conteudo_json,
  pontuacao_minima_aprovacao,
  igreja_id,
  created_by
) VALUES (
  'uuid-louvor-time',
  'Audição Louvor',
  'Teste prático de habilidade vocal e conhecimento bíblico',
  'pratico',
  '{
    "duracao_minutos": 30,
    "pontuacao_minima_aprovacao": 70,
    "criterios": [
      {"id": "1", "nome": "Qualidade Vocal", "descricao": "Afinação e técnica", "peso": 40},
      {"id": "2", "nome": "Conhecimento de Louvor", "descricao": "Teologia do louvor", "peso": 30},
      {"id": "3", "nome": "Liderança", "descricao": "Presença e carisma", "peso": 30}
    ]
  }',
  70.00,
  'uuid-igreja',
  'uuid-admin'
);
```

---

## 8️⃣ Próximos Passos (Implantação)

1. Executar migration: `supabase db push`
2. Criar página Admin de Testes (CRUD)
3. Criar Dashboard de Integração
4. Implementar notificações
5. Testar fluxo completo com candidato piloto

