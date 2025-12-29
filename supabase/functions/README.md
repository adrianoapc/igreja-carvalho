# Supabase Edge Functions

Este diretório contém as Edge Functions do Supabase, que são executadas no ambiente Deno.

## Configuração do VS Code

Para desenvolvimento adequado das Edge Functions, é necessário configurar o VS Code para reconhecer Deno:

### 1. Instalar Extensão Deno
Instale a extensão oficial do Deno:
- **ID:** `denoland.vscode-deno`
- **Nome:** Deno

### 2. Configurações Automáticas
O projeto já está configurado com:
- `.vscode/settings.json`: Habilita Deno apenas na pasta `supabase/functions`
- `.vscode/extensions.json`: Recomenda a instalação da extensão Deno
- `deno.json`: Configuração específica para as Edge Functions

### 3. Verificação
Após instalar a extensão, você deve ver:
- ✅ IntelliSense funcionando para APIs Deno (`Deno.env`, `Deno.serve`, etc.)
- ✅ Validação de tipos correta para imports ESM
- ✅ Sem erros de "módulo não encontrado" para URLs Deno

## Desenvolvimento

### Executando Localmente
```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar funções localmente
supabase functions serve
```

### Testando Funções
```bash
# Testar função específica
supabase functions serve nome-da-funcao --no-verify-jwt
```

## Estrutura
- Cada função fica em sua própria pasta
- `index.ts`: Ponto de entrada da função
- Imports usam URLs ESM compatíveis com Deno

## Troubleshooting

### Erro: "Deno não está habilitado"
1. Verifique se a extensão Deno está instalada
2. Certifique-se de que `deno.enable` está `true` em `.vscode/settings.json`
3. Reinicie o VS Code

### Erro: "Módulo não encontrado"
- As Edge Functions usam imports ESM diretos
- Não use `require()` - use `import` statements
- URLs como `https://deno.land/std@0.168.0/http/server.ts` são válidas