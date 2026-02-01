
# Links Externos de Cadastro com Tokens Opacos

## Resumo

Implementar um sistema seguro de links externos de cadastro usando **tokens opacos** de 12 caracteres (ex: `/c/7Kx9mPqR2wYn`) que impedem enumeração e vazamento de dados, garantindo que cada cadastro seja corretamente vinculado a uma igreja e filial.

---

## Problema Atual

| Componente | Status | Problema |
|------------|--------|----------|
| `shortLinkUtils.ts` | Quebrado | Codificação base58 perde dados do UUID |
| Rota `/s/:slug` | Inexistente | Nenhuma rota captura esses links |
| `cadastro-publico` | Falho | Não persiste `igreja_id` nem `filial_id` |
| Visitantes cadastrados | Órfãos | Ficam sem vínculo com igreja/filial |

---

## Solução: Token Opaco

- Token aleatório de 12 caracteres (alfabeto sem ambíguos)
- Armazenado na coluna `link_token` da tabela `filiais`
- Gerado automaticamente via trigger ao criar filial
- Impossível de adivinhar (~58^12 = 1.4×10^21 combinações)

**Exemplo de URLs:**
```
https://app.../c/7Kx9mPqR2wYn
https://app.../c/7Kx9mPqR2wYn?tipo=visitante
https://app.../c/7Kx9mPqR2wYn?tipo=membro&aceitou=true
```

---

## Fluxo de Funcionamento

```text
1. Admin acessa "Links Externos" em Pessoas
   ↓
2. Sistema busca link_token da filial atual
   ↓
3. Gera links: https://app.../c/{token}?tipo=visitante
   ↓
4. Admin compartilha link (WhatsApp, QR Code)
   ↓
5. Visitante acessa link
   ↓
6. ShortLinkRedirect.tsx busca filial pelo token
   ↓
7. Redireciona para /cadastro/visitante?igreja_id=X&filial_id=Y
   ↓
8. Formulário captura IDs da URL
   ↓
9. Edge function salva visitante COM igreja_id e filial_id
   ↓
10. Visitante aparece na lista da filial correta!
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migração SQL** | Criar | Adicionar `link_token` + trigger de geração automática |
| `src/pages/cadastro/ShortLinkRedirect.tsx` | Criar | Resolver token e redirecionar |
| `src/App.tsx` | Modificar | Adicionar rota `/c/:token` |
| `src/pages/cadastro/Visitante.tsx` | Modificar | Ler `igreja_id`/`filial_id` da URL e passar para edge |
| `src/pages/cadastro/Membro.tsx` | Modificar | Ler `igreja_id`/`filial_id` da URL e passar para edge |
| `src/pages/cadastro/Index.tsx` | Modificar | Ler IDs da URL e propagar para subpáginas |
| `supabase/functions/cadastro-publico/index.ts` | Modificar | Aceitar e persistir `igreja_id`/`filial_id` |
| `src/components/pessoas/LinksExternosCard.tsx` | Modificar | Buscar `link_token` e gerar links com ele |
| `src/lib/shortLinkUtils.ts` | Remover | Não mais necessário |

---

## Detalhes Técnicos

### 1. Migração SQL

```sql
-- Adicionar coluna para token de link público
ALTER TABLE filiais ADD COLUMN link_token TEXT UNIQUE;

-- Função para gerar token seguro (exclui caracteres ambíguos: 0, O, I, l, 1)
CREATE OR REPLACE FUNCTION generate_secure_token(length INT DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-gerar token em novas filiais
CREATE OR REPLACE FUNCTION set_filial_link_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.link_token IS NULL THEN
    LOOP
      NEW.link_token := generate_secure_token(12);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM filiais WHERE link_token = NEW.link_token);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER filiais_set_link_token
BEFORE INSERT ON filiais
FOR EACH ROW
EXECUTE FUNCTION set_filial_link_token();

-- Gerar tokens para filiais existentes
UPDATE filiais 
SET link_token = generate_secure_token(12) 
WHERE link_token IS NULL;
```

### 2. ShortLinkRedirect.tsx (Nova Página)

```tsx
// src/pages/cadastro/ShortLinkRedirect.tsx
export default function ShortLinkRedirect() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    async function resolveToken() {
      const { data: filial } = await supabase
        .from('filiais')
        .select('id, igreja_id')
        .eq('link_token', token)
        .single();

      if (!filial) {
        setError(true);
        return;
      }

      // Determinar destino baseado no tipo
      const tipo = searchParams.get('tipo') || 'visitante';
      const aceitou = searchParams.get('aceitou');

      const params = new URLSearchParams();
      params.set('igreja_id', filial.igreja_id);
      params.set('filial_id', filial.id);
      if (aceitou) params.set('aceitou', aceitou);

      let path = '/cadastro';
      if (tipo === 'visitante') path = '/cadastro/visitante';
      else if (tipo === 'membro') path = '/cadastro/membro';

      navigate(`${path}?${params.toString()}`, { replace: true });
    }

    resolveToken();
  }, [token]);

  if (error) {
    return <div>Link inválido ou expirado</div>;
  }

  return <Loader2 className="animate-spin" />;
}
```

### 3. Modificações no cadastro-publico Edge Function

Adicionar campos `igreja_id` e `filial_id` na inserção de visitantes:

```typescript
// Na interface CadastroVisitanteData
interface CadastroVisitanteData {
  // ... campos existentes ...
  igreja_id?: string;  // NOVO
  filial_id?: string;  // NOVO
}

// Na inserção
const { data: newData, error: insertError } = await supabase
  .from('profiles')
  .insert({
    // ... campos existentes ...
    igreja_id: visitanteData.igreja_id || null,
    filial_id: visitanteData.filial_id || null,
  })
```

### 4. LinksExternosCard Atualizado

```tsx
// Buscar link_token da filial atual
const { data: filial } = useQuery({
  queryKey: ['filial-link-token', filialId],
  queryFn: async () => {
    const { data } = await supabase
      .from('filiais')
      .select('link_token')
      .eq('id', filialId)
      .single();
    return data;
  },
  enabled: !!filialId && !isAllFiliais
});

// Gerar links usando o token
const links = [
  {
    title: "Link para Visitantes",
    url: `${baseUrl}/c/${filial?.link_token}?tipo=visitante`,
  },
  // ...
];
```

---

## Segurança

| Aspecto | Proteção |
|---------|----------|
| Adivinhação de token | Impossível (58^12 combinações) |
| Enumeração de igrejas | Impossível (tokens aleatórios) |
| Rate limiting | Já implementado (10 req/min) |
| IP blocking | Já implementado |
| Dados expostos | Apenas nome retornado (mínimo necessário) |

---

## Resultado Esperado

- Links de cadastro funcionais e seguros
- Visitantes corretamente vinculados à igreja/filial de origem
- URLs curtas e amigáveis para QR Codes
- Impossível descobrir links de outras igrejas
- Compatível com fluxo multi-tenant existente
