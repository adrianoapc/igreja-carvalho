# 📊 Dashboard de Gestão de Voluntariado

## Visão Geral

Tela premium para **pastores e líderes** gerenciarem candidatos voluntários com estatísticas avançadas, insights e ferramentas de administração.

---

## ✨ Funcionalidades Principais

### 1. **Estatísticas em Tempo Real**
- 📊 Total de candidatos
- ⏳ Pendentes de análise
- 🔍 Em processo de análise
- ✅ Aprovados
- ❌ Rejeitados

### 2. **Gráficos Interativos**
- **Evolução Temporal**: Gráfico de barras mostrando candidaturas nos últimos 6 meses
- **Distribuição por Ministério**: Gráfico de pizza com percentuais por área
- **Tendências**: LineChart (preparado para expansão)

### 3. **Cards de Insights Inteligentes**
- 🚨 **Alertas**: Candidatos pendentes há mais de 7 dias
- 🎯 **Metas**: Progresso de aprovações mensais
- ⏱️ **Tempo Médio**: Análise de tempo de resposta
- 🏆 **Conquistas**: Ministérios com maior crescimento

### 4. **Gestão de Candidatos**
- Lista completa com filtros por status e ministério
- Ações rápidas:
  - **Pendente** → Analisar ou Aprovar
  - **Em Análise** → Aprovar ou Rejeitar
  - **Aprovado** → Iniciar Trilha de Integração
- Informações de contato (telefone, email)
- Data de inscrição e histórico

### 5. **Filtros e Exportação**
- Filtro por status (Todos, Pendente, Em Análise, etc.)
- Filtro por ministério
- Botão de exportação de dados (preparado)

---

## 🎨 Design Premium

### Componentes Criados
1. **`MetricCard`**: Cards de métricas com:
   - Ícones coloridos
   - Valores destacados
   - Indicadores de tendência (↑ ↓)
   - Descrições contextuais

2. **`InsightCard`**: Cards de insights com:
   - 4 tipos (alerta, meta, tempo, conquista)
   - Bordas coloridas
   - Badges informativos
   - Valores destacados

3. **Dashboard Principal**: 
   - Animações com Framer Motion
   - Hover effects
   - Gradientes sutis
   - Responsivo (mobile-first)

---

## 🛠️ Tecnologias Utilizadas

- **React** + TypeScript
- **Framer Motion** (animações)
- **Recharts** (gráficos)
- **Shadcn/ui** (componentes)
- **Supabase** (backend)
- **Tailwind CSS** (estilização)

---

## 📍 Rotas

- **`/voluntariado`**: Tela de inscrição para membros
- **`/voluntariado/candidatos`**: Dashboard de gestão (pastores/líderes)

---

## 🚀 Próximas Melhorias Sugeridas

1. ✅ Exportação para Excel/PDF
2. ✅ Notificações push para novos candidatos
3. ✅ Sistema de comentários por candidato
4. ✅ Histórico de mudanças de status
5. ✅ Integração com calendário para entrevistas
6. ✅ Dashboard de performance por líder de ministério
7. ✅ Relatórios mensais automatizados
8. ✅ Sistema de tags/categorias personalizadas

---

## 📊 Métricas de Sucesso

O dashboard foi projetado para melhorar:

- **Tempo de resposta**: Reduzir tempo médio de análise
- **Taxa de aprovação**: Acompanhar qualidade das candidaturas
- **Engajamento**: Aumentar conversão de candidatos em voluntários ativos
- **Transparência**: Visibilidade total do funil de voluntariado

---

Desenvolvido com ❤️ para otimizar a gestão de voluntariado na igreja.
