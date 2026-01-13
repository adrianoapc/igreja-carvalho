-- Tabela de rascunhos de itens por sessão (salvamento parcial)
create table if not exists public.sessoes_itens_draft (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  filial_id uuid null references public.filiais(id) on delete set null,
  sessao_id uuid not null references public.sessoes_contagem(id) on delete cascade,

  -- Canal do item
  is_digital boolean not null default false,
  origem_registro text not null default 'manual' check (origem_registro in ('manual','api')),

  -- Detalhamento do lançamento
  pessoa_id uuid null references public.profiles(id) on delete set null,
  forma_pagamento_id uuid null references public.formas_pagamento(id) on delete set null,
  conta_id uuid null references public.contas(id) on delete set null,
  categoria_id uuid null references public.categorias_financeiras(id) on delete set null,
  valor numeric(12,2) not null default 0,
  descricao text null,
  read_only boolean not null default false,

  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessoes_itens_draft_sessao on public.sessoes_itens_draft(sessao_id);
create index if not exists idx_sessoes_itens_draft_igreja on public.sessoes_itens_draft(igreja_id);
create index if not exists idx_sessoes_itens_draft_filial on public.sessoes_itens_draft(filial_id);

alter table public.sessoes_itens_draft enable row level security;

-- Seleção por acesso à mesma igreja/filial da sessão
drop policy if exists "itens_draft_select_same_scope" on public.sessoes_itens_draft;
create policy "itens_draft_select_same_scope"
on public.sessoes_itens_draft for select
using (
  exists (
    select 1 from public.sessoes_contagem s
    where s.id = sessoes_itens_draft.sessao_id
      and has_filial_access(s.igreja_id, s.filial_id)
  )
);

-- Admin/tesoureiro com acesso à filial pode inserir/alterar/excluir
drop policy if exists "itens_draft_manage_finance_roles" on public.sessoes_itens_draft;
create policy "itens_draft_manage_finance_roles"
on public.sessoes_itens_draft for all
using (
  exists (
    select 1 from public.sessoes_contagem s
    where s.id = sessoes_itens_draft.sessao_id
      and has_filial_access(s.igreja_id, s.filial_id)
  )
  and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'tesoureiro'::app_role))
)
with check (
  exists (
    select 1 from public.sessoes_contagem s
    where s.id = sessoes_itens_draft.sessao_id
      and has_filial_access(s.igreja_id, s.filial_id)
  )
  and (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'tesoureiro'::app_role))
);

comment on table public.sessoes_itens_draft is 'Itens de oferta em rascunho vinculados à sessão, para salvamento parcial antes do fechamento.';

-- Ligação de transações à sessão para consulta posterior
alter table public.transacoes_financeiras
  add column if not exists sessao_id uuid null references public.sessoes_contagem(id) on delete set null;

create index if not exists idx_transacoes_sessao_id on public.transacoes_financeiras(sessao_id);