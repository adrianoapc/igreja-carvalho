# Telas fora da navegação (Sidebar)

Este documento identifica telas que **não aparecem na navegação lateral** (Sidebar) e
arquivos de páginas que **não possuem rota registrada** em `src/App.tsx`.

**Fontes de evidência**:
- Rotas: `src/App.tsx`
- Navegação lateral: `src/components/layout/Sidebar.tsx`

## 1) Arquivos de páginas sem rota registrada em `App.tsx`

Telas que existem em `src/pages/` mas **não possuem import/rota** em `App.tsx`:

- `src/pages/Eventos.tsx` (a confirmar se ainda é utilizada)
- `src/pages/financas/ContasManutencao.tsx` (a confirmar se ainda é utilizada)

## 2) Rotas registradas em `App.tsx` que não aparecem na navegação lateral

Rotas abaixo **não possuem item na Sidebar**; podem ser acessadas via links internos,
atalhos, redirecionamentos ou fluxos secundários (a confirmar):

### Sistema / Auth
- `*`
- `/auth/*`
- `/auth/reset-password`
- `/biometric-login`
- `/install`
- `/maintenance`
- `/public/:slug`

### Admin
- `/admin`
- `/admin/chatbots`
- `/admin/mural`
- `/admin/notificacoes`
- `/admin/permissoes`
- `/admin/webhooks`

### Comunicação
- `/mural`
- `/publicacao`

### Pessoas
- `/pessoas/:id`
- `/pessoas/:id/editar`
- `/pessoas/contatos`
- `/pessoas/frequentadores`
- `/pessoas/membros`
- `/pessoas/pendentes`
- `/pessoas/todos`
- `/pessoas/visitantes`

### Intercessão
- `/intercessao`

### Gabinete
- `/gabinete/atendimento/:id`

### Eventos
- `/eventos/:id`
- `/eventos/categorias`
- `/eventos/geral`
- `/eventos/lista`
- `/eventos/liturgia`
- `/eventos/midias`
- `/eventos/posicoes`
- `/eventos/templates`
- `/eventos/times`

### Ensino
- `/ensino/dashboard`
- `/ensinamentos`
- `/jornadas/:id`
- `/jornadas/:id/board`
- `/cursos/:id/aula/:aulaId`

### Kids
- `/kids/config`
- `/kids/criancas`
- `/kids/dashboard`
- `/kids/scanner`
- `/kids/turma-ativa`
- `/checkin/:tipo/:id`

### Finanças
- `/financas/bases-ministeriais`
- `/financas/categorias`
- `/financas/centros-custo`
- `/financas/contas`
- `/financas/dashboard`
- `/financas/dashboard-ofertas`
- `/financas/dre`
- `/financas/entradas`
- `/financas/formas-pagamento`
- `/financas/fornecedores`
- `/financas/insights`
- `/financas/projecao`
- `/financas/reembolsos`
- `/financas/relatorios/ofertas`
- `/financas/saidas`

### Voluntariado
- `/voluntariado/candidatos`
- `/voluntariado/historico`

### Outros
- `/agenda`
- `/biblia`
- `/chamada`
- `/cultos`
- `/cultos/:id`
- `/cultos/geral`
- `/cultos/lista`
- `/cultos/liturgia`
- `/cultos/times`
- `/midias/geral`
- `/oracao/player/:escalaId`
- `/perfil`
- `/perfil/wallet`
- `/telao/:id`
- `/telao/liturgia/:id`
