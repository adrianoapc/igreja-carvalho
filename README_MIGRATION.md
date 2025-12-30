# 🔧 Aplicar Migration - Blocos Inteligentes

## ❌ Erro Atual

```
new row for relation "liturgias" violates check constraint "liturgias_tipo_conteudo_check"
```

## ✅ Solução

### Passo 1: Acessar Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral esquerdo)

### Passo 2: Executar Script SQL

1. Clique em **New Query**
2. Copie todo o conteúdo do arquivo `APLICAR_MIGRATION_BLOCOS.sql`
3. Cole no editor SQL
4. Clique em **Run** (ou pressione Cmd/Ctrl + Enter)

### Passo 3: Verificar Sucesso

Você deve ver no resultado:

```
✅ Constraint removida
✅ Nova constraint criada
✅ Comentário atualizado
✅ Índice criado
```

### Passo 4: Testar

1. Volte à aplicação
2. Tente adicionar um item de liturgia
3. O erro não deve mais aparecer

## 📋 Tipos Adicionados

Após aplicar a migration, os seguintes tipos serão aceitos:

### Manuais

- `VIDEO` - Vídeo (YouTube)
- `VERSICULO` - Versículo / Palavra
- `AVISO` - Aviso / Texto
- `TIMER` - Timer / Silêncio
- `IMAGEM` - Imagem/Slide
- `PEDIDOS` - Pedidos de Oração
- `QUIZ` - Quiz Interativo
- `AUDIO` - Áudio
- `TEXTO` - Texto simples

### Blocos Inteligentes (Automáticos)

- `BLOCO_TESTEMUNHO` - Gratidão (Testemunhos)
- `BLOCO_SENTIMENTO` - Clamor (Sentimentos)
- `BLOCO_VISITANTE` - Boas Vindas (Visitantes)
- `BLOCO_PEDIDOS` - Intercessão (Pedidos)

## 🤔 Dúvidas?

- O script é seguro e apenas atualiza a constraint
- Nenhum dado será perdido
- A operação é reversível
