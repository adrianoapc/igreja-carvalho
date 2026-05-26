# Causa raiz

O `buscar-pix-cron` chama o `santander-api` enviando `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.

Dentro do `santander-api`, a função `validateAuth` (linha 248-266) faz:

```ts
const { data: claims } = await supabaseAdmin.auth.getClaims(token)
if (claimsError || !claims?.claims) {
  return { authorized: false, error: 'Token inválido' }
}
```

`auth.getClaims()` valida **JWT de usuário** (com `sub`). O service_role key é um JWT de serviço, sem `sub` de usuário — por isso retorna `Token inválido`. Isso bate com a memória `santander-api-auth-requirement` (a função exige usuário real, não anon/service_role).

Não é problema do token OAuth2 do Santander — a requisição nem chega lá. Falha já na autenticação interna entre as duas edge functions.

# Fix proposto

Em `supabase/functions/santander-api/index.ts`, na função `validateAuth`, adicionar um **bypass para service_role** antes da chamada `getClaims`:

```ts
const token = authHeader.replace('Bearer ', '')

// Bypass: service_role é trusted (chamadas internas de cron/edge functions)
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (token === serviceKey) {
  return {
    authorized: true,
    context: { userId: 'service_role', igrejaId: targetIgrejaId, roles: ['service_role'] },
  }
}

// Caso contrário, validar como JWT de usuário
const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token)
...
```

# Por que isso é seguro

- `SUPABASE_SERVICE_ROLE_KEY` só existe dentro do runtime das edge functions; nunca é exposto ao cliente.
- Já é a chave usada para operações administrativas em todas as outras funções do projeto.
- O único caller interno hoje é `buscar-pix-cron`, que apenas dispara `action: 'buscar_pix'` para integrações Santander já cadastradas.
- Não enfraquece o caminho de usuário: chamadas vindas do app continuam passando por `getClaims` + checagem de `user_roles`.

# Validação

1. Re-executar `buscar-pix-cron` via curl e verificar que `success: true` e `importados >= 0` sem o erro `Token inválido`.
2. Conferir log do `santander-api` — não deve mais aparecer `Authorization failed`.
3. Garantir que o cron `buscar-pix-cron-30min` no `pg_cron` continue rodando normalmente no próximo ciclo.

# Atualização de memória

Após validar, atualizar `mem://architecture/financial/santander-api-auth-requirement` para registrar que service_role é aceito em chamadas internas (cron / edge-to-edge), mantendo a exigência de JWT de usuário para chamadas externas.
