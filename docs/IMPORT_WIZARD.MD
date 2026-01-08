**Resumo**

- Objetivo: evoluir `ImportarExcelDialog` para um Wizard responsivo, com mapeamento inteligente, validação robusta, importação em chunks, relatórios e opção de desfazer.
- Escopo inicial: módulo de Finanças (entradas/saídas), reutilizável para outros domínios futuramente.

**Layout Responsivo**

- **Tamanho máx.:** `max-w-4xl` no desktop e `max-h-[80vh]` com `ScrollArea` interno para prevenir overflow.
- **Wizard:** 4 passos com cabeçalho fixo (título + etapa atual) e rodapé fixo (ações). Navegação por teclado e indicadores de progresso.
- **Grid de prévia:** tabela compacta; usar virtualização para grandes volumes; colunas colapsáveis e sticky header.
- **Mobile-first:** campos empilhados, paddings reduzidos, ações sempre acessíveis no rodapé.
- **A11y:** foco visível, ordem lógica de tabulação, labels/aria, avisos claros.

**Fluxo (4 passos)**

- **Upload:** arrastar/soltar; aceitar `XLSX/CSV`; se múltiplas planilhas, seletor de aba; mostrar contagem de linhas e tamanho.
- **Mapeamento:** auto-detecção por heurísticas (descrição, valor, datas, status, conta, categoria, fornecedor, observações); selects para campos obrigatórios com sugestão.
- **Validação:** pré-checagem linha a linha (tipos, datas, decimais, valores > 0, chaves existentes); resumo por tipo de erro com contadores; permitir correções/exclusões.
- **Confirmação:** total válido, importação em chunks com barra de progresso/ETA; opção de baixar rejeitados.

**Mapeamento de Campos**

- **Obrigatórios:** `descricao`, `valor`, `data_vencimento`, `conta`, `categoria`.
- **Sugeridos:** `forma_pagamento`, `fornecedor` (nome/CNPJ), `centro_custo`, `subcategoria`, `base_ministerial`, `status`, `observacoes`, `data_pagamento`.
- **Presets:** salvar “modelo de mapeamento” por `igreja/filial` para reuso (armazenar em tabela `import_presets` com RLS por contexto).
- **Auto-sugestões:** inferir `valor` por padrão monetário; `data` por formatos comuns; normalizar decimais pt-BR; aceitar combinações (`yyyy-MM-dd`, `dd/MM/yyyy`, etc.).
- **Template:** botão “Baixar modelo” (`.xlsx/.csv`) com cabeçalhos esperados, gerado no cliente via `xlsx` (ou CSV simples) para uso imediato.

**Validação e Correções**

- **Tipagem:** números, datas ($yyyy$-$MM$-$dd$ ou $dd/MM/yyyy$), `valor > 0`, strings sanitizadas.
- **Chaves estrangeiras:** garantir existência de `conta_id`, `categoria_id`, `fornecedor_id` (deduplicar fornecedor por CNPJ/CPF; criar seguro se não existir).
- **Regras:** impedir `categoria_id` com tipo incompatível ao `tipo` (entrada/saída); respeitar `igreja_id/filial_id` do contexto e RLS.
- **Erros por linha:** permitir excluir/ajustar linhas problemáticas antes de importar; mostrar tooltip com motivo.

**UX e Feedback**

- **Chunks:** importar em blocos (ex.: 100 linhas); barra de progresso com tempo estimado.
- **Relatório:** baixar CSV de rejeitados + motivo; resumo pós-import com contagens e links.
- **Logs:** métricas de processamento; IDs afetados; link para visão de auditoria.
- **Undo:** “Desfazer” a última importação (soft delete ou reversão transacional quando possível) com guardrails.

**Performance e Robustez**

- **Parser:** `xlsx/sheetjs` já em uso; tratar múltiplas abas e tipos de célula; para CSV grandes, opcional `papaparse` com streaming.
- **Limites:** tamanho máximo de arquivo (ex.: 10 MB) e número de linhas (ex.: 10k); fallback para processamento no backend ao exceder.
- **Locale:** normalizar separadores decimais pt-BR (`,` → `.`); detectar moeda e símbolo.
- **Segurança:** sanitizar strings (ex.: `dompurify` quando renderizado); evitar timeouts; retentativas em falhas de rede; backoff exponencial.

**Arquitetura Técnica**

- **Front-end (React + Vite):**
  - Componente `ImportarExcelWizard` (novo) dentro de `src/components/financas/` ou página dedicada.
  - Steps usando estado local e/ou `useReducer`; acessibilidade com Radix; virtualização com `@tanstack/react-virtual` (leve, Tree-shakable).
  - Presets: CRUD via `react-query` com cache por `igrejaId/filialId`.
  - Template: geração com `xlsx`/CSV; download no cliente.
- **Backend (Supabase):**
  - Função Edge `import_financas_v1`: recebe payload mapeado e valida; aplica chunking; cria logs e permite undo.
  - Tabelas auxiliares:
    - `import_jobs` (status, contagens, timestamps, usuário, contexto igreja/filial).
    - `import_job_items` (linha original, erros, status, FK para transação criada).
    - `import_presets` (modelo por igreja/filial, JSON mapping, nome, versão).
  - RLS: escopo por `igreja_id` e opcional `filial_id`.
  - Undo: procedure para reverter as transações criadas por um `import_job_id`.

**Esquema de Payload (front → edge)**

- `job_meta`: `{ tipo: "entrada"|"saida", igreja_id, filial_id, usuario_id }`
- `mapping`: `{ descricao, valor, data_vencimento, data_pagamento?, status?, conta?, categoria?, fornecedor?, observacoes? }`
- `rows`: `Array<{ [col:string]: string|number|Date }>` já normalizados (datas `yyyy-MM-dd`, decimais `.`).
- `options`: `{ chunkSize: number, dryRun?: boolean }`

**Respostas do Backend**

- `202 Accepted`: processamento assíncrono (grande volume). Retorna `job_id` e contagens preliminares.
- `200 OK`: processamento síncrono (pequeno volume). Retorna resumo e IDs criados.
- Sempre: coleção de rejeitados com motivos (limitada), paginação por job.

**Decisões a Confirmar**

- **Virtualização:** `@tanstack/react-virtual` no front vs. paginação por backend.
- **Streaming CSV:** adicionar `papaparse` para arquivos grandes.
- **Limites:** tamanho máx. de arquivo (ex.: 10 MB), linhas (ex.: 10k) e `chunkSize` (ex.: 100).
- **Undo:** soft delete vs. reversão transacional; janela de tempo (ex.: 24h) e permissões.
- **Presets:** escopo por igreja e por filial? versão por preset? compartilhamento entre filiais.
- **Criação de fornecedor:** automática com validação CNPJ/CPF vs. apenas quando mapeado explicitamente.
- **Template padrão:** `.xlsx` e `.csv` ambos, ou apenas `.xlsx`?
- **Seleção de planilha:** obrigatório mostrar seletor quando houver >1 aba.
- **Acessibilidade:** padrão mínimo (labels+foco) vs. completo (atalhos de teclado, ARIA detalhado).

**Integração com o Componente Atual**

- O arquivo `src/components/financas/ImportarExcelDialog.tsx` já realiza leitura via `xlsx`, mapeamento heurístico e importação direta.
- Evolução sugerida: migrar para `Wizard` com etapas; adicionar seleção de planilha, presets, validação linha a linha, chunking e relatório de rejeitados.
- Manter `ResponsiveDialog` com `max-w-4xl` e `max-h-[80vh]` e rodapé fixo; mover preview para grid virtualizado.

**Próximos Passos**

- Após confirmação das decisões acima:
  - Implementar UI do Wizard (steps + rodapé) e seleção de planilha.
  - Adicionar presets (CRUD) e template download.
  - Normalização robusta (pt-BR) de datas/decimais.
  - Validação linha a linha com feedback e edição/exclusão.
  - Chunking e relatório de rejeitados; logs e undo via Supabase.
  - A11y e performance: foco, ordem tab, virtualização.
