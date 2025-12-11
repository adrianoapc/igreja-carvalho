# disparar-alerta

Notification Dispatcher - Edge Function central que orquestra todos os alertas do sistema.

## Funcionamento

1. **Recebe um evento** com dados contextuais
2. **Busca regras** cadastradas no banco para esse evento
3. **Identifica destinatários** por role ou usuário específico
4. **Dispara notificações** via múltiplos canais (In-App, WhatsApp, Push)

## Payload

```typescript
{
  evento: string;           // slug do evento (ex: 'novo_visitante')
  dados: Record<string, any>; // variáveis para template (ex: { nome: 'João', valor: 500 })
  user_id_alvo?: string;    // opcional: enviador para usuário específico, ignora role
}
```

## Exemplo de Uso

### Frontend
```typescript
const { data, error } = await supabase.functions.invoke('disparar-alerta', {
  body: {
    evento: 'novo_visitante',
    dados: {
      nome: 'João Silva',
      telefone: '(11) 98765-4321',
      data: '2025-12-11'
    },
    user_id_alvo: null // ou UUID específico
  }
});

if (error) console.error('Erro ao disparar:', error);
else console.log('Alerta disparado:', data);
```

### Backend (Trigger ou Mutation)
```typescript
const { error } = await supabase.functions.invoke('disparar-alerta', {
  body: {
    evento: 'reembolso_aprovado',
    dados: {
      solicitante: 'Maria Santos',
      valor: 'R$ 150,00',
      data_aprovacao: new Date().toLocaleDateString('pt-BR')
    }
  }
});
```

## Fluxo Interno

1. **Busca Regras**: `SELECT * FROM notificacao_regras WHERE evento = ?`
2. **Busca Destinatários**:
   - Se `user_id_alvo`: busca perfil específico
   - Se `role_destinatario`: busca todos os usuários com aquele role
3. **Formata Templates**: Substitui `{{chave}}` pelos valores em `dados`
4. **Dispara por Canal**:
   - **In-App**: INSERT na tabela `notifications`
   - **WhatsApp**: POST para webhook do Make
   - **Push**: Placeholder (implementar OneSignal/Expo)

## Variáveis de Ambiente

- `SUPABASE_URL`: Já definida automaticamente
- `SUPABASE_SERVICE_ROLE_KEY`: Já definida automaticamente
- `MAKE_WEBHOOK_URL`: URL do webhook Make para WhatsApp (obrigatória se usar canal_whatsapp)

## Response

```typescript
{
  sucesso: boolean;
  evento: string;
  regrasAplicadas: number;
  destinatariosAlcancados: number;
  notificacoesDisparadas: number;
  // ou em caso de erro:
  erro?: string;
}
```

## Segurança

- Usa `SUPABASE_SERVICE_ROLE_KEY` para acessar dados de qualquer role
- Validação de entrada obrigatória (evento)
- Logs detalhados para auditoria
- Tratamento robusto de erros por canal
