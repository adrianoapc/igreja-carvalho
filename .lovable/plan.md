

# Auto-completar Endereço por CEP + Campo de Ano Opcional no Aniversário

## Situação Atual

### Problema 1: CEP
- Os campos de CEP nos formulários de pessoas **não fazem busca automática**
- O usuário precisa digitar manualmente todos os campos de endereço
- Isso causa erros de digitação e torna o cadastro mais lento

### Problema 2: Aniversário
- Atualmente o campo de aniversário só aceita **dia e mês**
- O ano é gravado como `1900` por padrão (apenas para permitir filtros de aniversariantes)
- Não há opção de informar o ano real de nascimento quando conhecido

---

## Proposta de Implementação

### 1. Hook Reutilizável para Busca de CEP

Criar um hook `useCepAutocomplete` que:
- Monitora o valor do CEP digitado
- Quando CEP tem 8 dígitos, consulta a API ViaCEP
- Retorna os dados do endereço para preencher automaticamente

**API ViaCEP** (gratuita, sem necessidade de API key):
```
GET https://viacep.com.br/ws/{cep}/json/
```

Retorna:
```json
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "complemento": "de 1047 a 1865 - lado ímpar",
  "bairro": "Bela Vista",
  "localidade": "São Paulo",
  "uf": "SP"
}
```

### 2. Campo de Ano Opcional

Adicionar um terceiro select para o **ano de nascimento** (opcional):
- Lista de anos de 1920 até o ano atual
- Se não preenchido, mantém comportamento atual (ano 1900)
- Se preenchido, grava a data completa com o ano real

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useCepAutocomplete.ts` | **Criar** | Hook para consultar ViaCEP |
| `src/components/pessoas/CadastrarPessoaDialog.tsx` | Modificar | Adicionar auto-complete de CEP e campo de ano |
| `src/components/pessoas/EditarContatosDialog.tsx` | Modificar | Adicionar auto-complete de CEP |
| `src/components/pessoas/EditarDadosPessoaisDialog.tsx` | Modificar | Adicionar campo de ano opcional |

---

## Detalhes Técnicos

### Hook useCepAutocomplete

```typescript
interface CepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

function useCepAutocomplete() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCep = async (cep: string): Promise<CepData | null> => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );
      const data = await response.json();

      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }

      return data;
    } catch {
      setError('Erro ao buscar CEP');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarCep, loading, error };
}
```

### Integração no Formulário de Cadastro

O campo de CEP terá um `onBlur` que dispara a busca:

```tsx
const handleCepBlur = async () => {
  const dados = await buscarCep(formData.cep);
  if (dados) {
    setFormData({
      ...formData,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.localidade,
      estado: dados.uf,
    });
  }
};
```

Indicador visual de loading durante a busca:
- Spinner no campo de CEP enquanto busca
- Toast de erro se CEP não encontrado

### Campo de Ano no Aniversário

Layout atualizado:

```text
Data de aniversário
┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│  Dia   ▼    │ │   Mês   ▼   │ │  Ano (opcional)   ▼    │
└─────────────┘ └─────────────┘ └─────────────────────────┘
```

Lógica de gravação:
```typescript
// Se ano preenchido, usa o ano real
// Se não, usa 1900 como placeholder
const ano = formData.ano_nascimento || "1900";
const dataNascimento = `${ano}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
```

### Lista de Anos

```typescript
const anoAtual = new Date().getFullYear();
const anos = Array.from(
  { length: anoAtual - 1920 + 1 }, 
  (_, i) => (anoAtual - i).toString()
);
// Gera: ["2025", "2024", "2023", ..., "1920"]
```

---

## Fluxo de Uso - CEP

1. Usuário digita o CEP no campo
2. Ao sair do campo (blur), sistema busca na API ViaCEP
3. Se encontrado: preenche automaticamente logradouro, bairro, cidade e estado
4. Se não encontrado: mostra mensagem "CEP não encontrado"
5. Usuário pode editar os campos preenchidos se necessário

## Fluxo de Uso - Ano de Nascimento

1. Usuário seleciona dia e mês (obrigatório para aniversariantes)
2. Opcionalmente seleciona o ano de nascimento
3. Se ano informado: grava data completa (ex: 1985-03-15)
4. Se ano não informado: grava com ano 1900 (ex: 1900-03-15)

---

## Resultado Esperado

**Após implementação:**
- Cadastro de endereço 80% mais rápido (apenas digitar CEP)
- Menos erros de digitação em endereços
- Possibilidade de calcular idade real quando ano é informado
- Compatibilidade retroativa (sistema continua funcionando com registros sem ano)

