# RLS e Seguranca

## Objetivo
Descrever como o Row Level Security protege o banco de dados e como papeis sao aplicados.

## Principios
- Menor privilegio: politicas restringem linha a linha por igreja e papel.
- Separacao de papeis: `admin` > `tecnico` > `lider` > `membro` (leitura/escrita conforme necessidade).
- JWT como fonte de verdade: claims `sub` e `role` sao lidas nas politicas.

## Fluxo de autorizacao
```mermaid
flowchart LR
    Req[Request autenticada] --> JWT[JWT claims]
    JWT --> Role[Determina papel]
    Role --> RLS[Politicas RLS]
    RLS --> DB[(Postgres)]
    DB --> Resp[Resposta filtrada]
```

## Estrutura e politicas
- Tabelas chave usam colunas `igreja_id` e `owner_id` para filtro por escopo.
- Politicas por operacao (select/insert/update/delete) verificam `auth.uid()` e `current_setting('request.jwt.claim.role')`.
- Views e RPC expostas respeitam as mesmas politicas.

## Exemplo de politica (pseudo-SQL)
```sql
create policy select_own_church on public.pessoas
for select
using (
  igreja_id = current_setting('request.jwt.claim.igreja_id', true)::uuid
);
```

## Storage
- Buckets separados por contexto sensivel; URLs assinadas para acesso temporario.
- Upload so e permitido a usuarios autenticados e dentro do bucket permitido ao papel.

## Boas praticas
- Ativar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em todas as tabelas expostas.
- Auditar politicas em novas migracoes e vincular ao ADR correspondente.
- Testar politicas com usuarios de cada papel antes de liberar features.

## Funcoes de Seguranca

| Funcao | Escopo | Descricao |
|--------|--------|-----------|
| `has_role(uuid, app_role)` | Global | Verifica papel do usuario |
| `has_role_in_igreja(uuid, app_role, uuid)` | Por Igreja | Verifica papel em igreja especifica |
| `has_filial_access(uuid, uuid)` | Por Filial | Valida acesso a filial via JWT |
| `get_current_user_igreja_id()` | Contexto | Retorna igreja_id do usuario atual |
| `get_jwt_igreja_id()` | JWT | Extrai igreja_id do token |
| `get_jwt_filial_id()` | JWT | Extrai filial_id do token |

## Hierarquia de Papeis (ADR-021)

```
super_admin (global)
  └── admin / admin_igreja (por tenant)
        └── admin_filial (por filial)
              └── pastor / lider / secretario / tecnico / tesoureiro
                    └── membro / basico
```

## Referencias
- ADR: `adr/ADR-003-rls-e-modelo-permissoes.md`
- ADR Multi-Tenant: `adr/ADR-021-multi-tenant-arquitetura.md`
- Controle de Isolamento: `../controle-multi-tenant.md`
- Autenticacao: `02-autenticacao-supabase.MD`
- Fluxo de dados: `03-fluxo-de-dados.MD`
