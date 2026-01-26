
# Plano: Implementar Interface de Check-in para Operadores

## Contexto

A aba "Check-in" em `/eventos/:id` (gestão do evento) exibe apenas "Em desenvolvimento". O operador não consegue fazer check-in na prática. 

A infraestrutura de backend já existe:
- Edge Function `checkin-inscricao` que valida e registra check-ins
- Tabela `inscricoes_eventos` com campos `qr_token`, `checkin_validado_em`, `checkin_validado_por`
- Tabela `checkins` para registro de presenças

O sistema Kids já implementa um scanner funcional que pode servir de referência.

---

## Solução Proposta

Criar um componente completo de check-in com:

1. **Scanner de QR Code** - Usar câmera para ler tokens
2. **Busca Manual** - Campo para digitar token/UUID ou buscar por nome/telefone
3. **Estatísticas** - Contagem de inscritos vs. presentes
4. **Lista de Check-ins Recentes** - Últimas validações em tempo real

---

## Componentes a Criar

### 1. `CheckinTabContent.tsx` (Principal)

```text
┌─────────────────────────────────────────────────────────┐
│  Check-in do Evento                                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  📷 SCANNER     │  │  Presentes: 45/120         │  │
│  │  [Ativar Câmera]│  │  ████████░░ 37.5%          │  │
│  └─────────────────┘  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  🔍 Busca Manual:                                       │
│  ┌──────────────────────────────────────┐ [Verificar]  │
│  │ Token, nome ou telefone...          │               │
│  └──────────────────────────────────────┘               │
├─────────────────────────────────────────────────────────┤
│  Últimos Check-ins                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ Maria Silva          há 2 min                 │   │
│  │ ✓ João Santos          há 5 min                 │   │
│  │ ✓ Ana Costa            há 8 min                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2. `CheckinScanner.tsx` (Modal com Câmera)

Usa `@yudiel/react-qr-scanner` (já instalado) para:
- Abrir câmera do dispositivo
- Ler QR Code automaticamente
- Extrair token de URLs tipo `/inscricao/{token}` ou `/eventos/checkin/{token}`
- Chamar Edge Function para validar
- Exibir feedback (sucesso/erro/já usado/pendente)

### 3. `CheckinManualSearch.tsx` (Busca por Nome/Token)

Campo que aceita:
- **Token UUID** → Busca direta em `inscricoes_eventos.qr_token`
- **Nome** → Busca em `profiles.nome` vinculado ao evento
- **Telefone** → Busca em `profiles.telefone`

Exibe lista de resultados com botão "Check-in" em cada item.

### 4. `CheckinRecentList.tsx` (Lista de Presenças)

- Consulta `inscricoes_eventos` onde `checkin_validado_em IS NOT NULL`
- Ordenado por mais recente primeiro
- Exibe nome, hora do check-in

---

## Detalhes Técnicos

### Fluxo do Scanner QR

1. Operador clica "Ativar Câmera" → Modal abre com scanner
2. Scanner lê QR Code → Extrai token da URL
3. Chama `supabase.functions.invoke("checkin-inscricao", { qr_token })`
4. Exibe resultado:
   - ✅ **Sucesso** → Nome + "Check-in confirmado" (tela verde)
   - ⚠️ **Já utilizado** → Nome + hora do check-in anterior (tela amarela)
   - ❌ **Não encontrado** → Mensagem de erro (tela vermelha)
   - 💰 **Pendente** → Nome + "Pagamento não confirmado" (tela laranja)
5. Após 3 segundos, retorna ao scanner para próximo

### Extração de Token

```typescript
const extractToken = (url: string): string | null => {
  // Aceita URLs como:
  // https://appcarvalho.lovable.app/inscricao/abc-123
  // https://appcarvalho.lovable.app/eventos/checkin/abc-123
  // Ou apenas o UUID diretamente
  const match = url.match(/\/inscricao\/([a-f0-9-]+)/i) 
             || url.match(/\/checkin\/([a-f0-9-]+)/i)
             || url.match(/^([a-f0-9-]{36})$/i);
  return match ? match[1] : null;
};
```

### Busca Manual

```typescript
// Por token exato
if (isUUID(input)) {
  query = supabase
    .from("inscricoes_eventos")
    .select("*, pessoa:profiles(nome, telefone, email)")
    .eq("evento_id", eventoId)
    .eq("qr_token", input);
} else {
  // Por nome ou telefone (ILIKE)
  query = supabase
    .from("inscricoes_eventos")
    .select("*, pessoa:profiles!inner(nome, telefone, email)")
    .eq("evento_id", eventoId)
    .or(`nome.ilike.%${input}%,telefone.ilike.%${input}%`, { foreignTable: 'pessoa' });
}
```

### Estatísticas

```typescript
// Total inscritos no evento
const { count: total } = await supabase
  .from("inscricoes_eventos")
  .select("id", { count: "exact", head: true })
  .eq("evento_id", eventoId)
  .is("cancelado_em", null);

// Presentes (com check-in)
const { count: presentes } = await supabase
  .from("inscricoes_eventos")
  .select("id", { count: "exact", head: true })
  .eq("evento_id", eventoId)
  .not("checkin_validado_em", "is", null);
```

---

## Alterações nos Arquivos

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/eventos/CheckinTabContent.tsx` | Componente principal da aba |
| `src/components/eventos/CheckinScanner.tsx` | Modal com scanner QR |
| `src/components/eventos/CheckinManualSearch.tsx` | Busca por nome/token |
| `src/components/eventos/CheckinRecentList.tsx` | Lista de check-ins recentes |
| `src/components/eventos/CheckinResultFeedback.tsx` | Feedback visual após scan |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/EventoDetalhes.tsx` | Substituir placeholder (linhas 535-547) por `<CheckinTabContent eventoId={id!} />` |

---

## Estrutura do CheckinTabContent

```typescript
interface CheckinTabContentProps {
  eventoId: string;
}

export function CheckinTabContent({ eventoId }: CheckinTabContentProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  
  // Queries para estatísticas e lista
  const { data: stats } = useQuery({...});
  const { data: recentCheckins } = useQuery({...});

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>Inscritos: {stats.total}</Card>
        <Card>Presentes: {stats.presentes}</Card>
        <Card>Pendentes: {stats.total - stats.presentes}</Card>
      </div>

      {/* Ações Rápidas */}
      <Card>
        <Button onClick={() => setScannerOpen(true)}>
          <Camera /> Abrir Scanner
        </Button>
      </Card>

      {/* Busca Manual */}
      <CheckinManualSearch eventoId={eventoId} />

      {/* Lista de Check-ins Recentes */}
      <CheckinRecentList eventoId={eventoId} />

      {/* Modal do Scanner */}
      <CheckinScanner 
        open={scannerOpen} 
        onClose={() => setScannerOpen(false)}
        onSuccess={() => refetchStats()}
      />
    </div>
  );
}
```

---

## Benefícios

1. **Operação Real** → Operador consegue fazer check-in com scanner ou busca
2. **Flexibilidade** → Duas formas de validar (QR Code ou manual)
3. **Visibilidade** → Estatísticas e lista em tempo real
4. **Mobile-First** → Interface otimizada para celular do operador
5. **Feedback Visual** → Estados claros (sucesso, erro, já usado, pendente)

---

## Ordem de Implementação

1. Criar `CheckinTabContent.tsx` com estrutura base e estatísticas
2. Criar `CheckinRecentList.tsx` com lista de presenças
3. Criar `CheckinManualSearch.tsx` com busca e validação
4. Criar `CheckinScanner.tsx` com modal de câmera
5. Criar `CheckinResultFeedback.tsx` para feedback visual
6. Integrar no `EventoDetalhes.tsx`
7. Testar fluxo completo
