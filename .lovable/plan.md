

## Plano: Corrigir build errors e investigar 404 na rota pública Café V&P

### Problema 1: 404 na rota `/cadastro/cafe-vp` (screenshot do usuário)

A rota está corretamente definida no `App.tsx` (linha 280) e o componente `CafeVP.tsx` existe. O 404 acontece no domínio publicado `app.igrejacarvalho.com.br`, o que indica um problema de **configuração do servidor/hosting** — o servidor não está fazendo SPA fallback (servir `index.html` para todas as rotas client-side).

**Ação necessária**: Verificar a configuração de deploy/hosting. Se estiver usando Netlify, precisa de um `_redirects` ou `netlify.toml`. Se Vercel, um `vercel.json`. Se outro servidor (Nginx, Apache), precisa configurar fallback para `index.html`. Na Lovable, o preview já funciona, mas o domínio customizado precisa dessa configuração.

**No projeto Lovable**: Criar/verificar o arquivo `public/_redirects` com:
```
/*    /index.html   200
```

### Problema 2: Build error em `cadastro-publico/index.ts`

O `.single()` na linha 428 retorna `PostgrestBuilder` que perde o método `.eq()` para encadeamento posterior. A chamada `.single()` deve ser movida para **depois** de todos os `.eq()`.

**Arquivo**: `supabase/functions/cadastro-publico/index.ts`
**Fix**: Remover `.single()` da linha 428 e adicioná-lo após os `.eq()` condicionais (antes do `await`).

### Problema 3: Build error em `processar-nota-fiscal/index.ts`

Variável `supabaseService` declarada duas vezes no mesmo bloco (linhas 260 e 418).

**Arquivo**: `supabase/functions/processar-nota-fiscal/index.ts`
**Fix**: Renomear a segunda declaração na linha 418 para reutilizar a variável existente, ou remover o `const` e reatribuir.

### Detalhes técnicos

| Arquivo | Linha | Erro | Correção |
|---|---|---|---|
| `cadastro-publico/index.ts` | 428 | `.single()` antes de `.eq()` quebra tipagem | Mover `.single()` para linha 435 |
| `processar-nota-fiscal/index.ts` | 260, 418 | `supabaseService` redeclarado | Remover segunda declaração, reusar a primeira |
| `public/_redirects` | — | Arquivo inexistente | Criar com `/*  /index.html  200` |

