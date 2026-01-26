
# Plano: Adicionar Rota Pública `/inscricao/:token`

## Problema

A página do QR Code retorna erro **404** porque a rota `/inscricao/:token` não existe no React Router, mesmo tendo o componente `InscricaoPublica.tsx` implementado.

**URL que falha:** `app.igrejacarvalho.com.br/inscricao/4d239421-3435-4c2b-8b97-700ae012b562`

---

## Causa Raiz

O arquivo `src/App.tsx` não possui a rota `/inscricao/:token` registrada. Quando o usuário acessa essa URL, cai no "Catch-all" da linha 1081 que redireciona para `NotFound`.

---

## Solução

Adicionar a rota **pública** (sem autenticação) no arquivo `src/App.tsx`:

```typescript
// Adicionar import no topo (junto com outros lazy imports)
const InscricaoPublica = lazy(() => import("./pages/InscricaoPublica"));

// Adicionar rota na seção de rotas públicas (após linha 245)
<Route path="/inscricao/:token" element={<InscricaoPublica />} />
```

---

## Localização no Código

A rota será adicionada na seção de **rotas públicas**, junto com outras rotas que não requerem autenticação:

```typescript
{/* Cadastro Público */}
<Route path="/cadastro" element={<CadastroIndex />} />
<Route path="/cadastro/visitante" element={<CadastroVisitante />} />
<Route path="/cadastro/membro" element={<CadastroMembro />} />
<Route path="/cadastro/igreja" element={<NovaIgreja />} />

{/* NOVA ROTA - Inscrição Pública (QR Code) */}
<Route path="/inscricao/:token" element={<InscricaoPublica />} />
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar import + rota `/inscricao/:token` |

---

## Resultado Esperado

Após a alteração, URLs como `app.igrejacarvalho.com.br/inscricao/4d239421-3435-4c2b-8b97-700ae012b562` abrirão corretamente a página de comprovante de inscrição com o QR Code.
