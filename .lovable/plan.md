
# Plano: Correção do Botão Agendar, Exibição de Erros de Importação e Acesso aos Contatos

## Resumo dos Problemas Identificados

### 1. Botão "Agendar" na Lista de Pessoas
- **Problema:** O botão navega para `/eventos/nova-agenda` que **não existe** como rota no sistema
- **Localização:** `src/pages/pessoas/Todos.tsx` (linhas 367 e 477)
- **Solução:** Alterar para abrir o `AgendarContatoDialog`, que:
  - Cria contatos agendados na tabela `visitante_contatos`
  - Permite definir responsável, tipo (telefone/WhatsApp/email/presencial) e observações
  - Já possui toda a lógica pronta

### 2. Tela de Contatos Agendados "Sumiu"
- **Realidade:** A tela **existe** e está acessível em `/pessoas/contatos`
- **Acesso atual:** Dashboard Pessoas → Card "Contatos Agendados"
- **Arquivo:** `src/pages/pessoas/Contatos.tsx`
- **Sugestão:** Adicionar ícone/botão de atalho no header da página Todos.tsx para acesso rápido

### 3. Importação: Linhas Rejeitadas sem Detalhes de Erro
- **Problema:** O usuário vê "100 linhas rejeitadas" mas não consegue ver **quais erros** antes de reimportar
- **Situação atual:**
  - `ImportarExcelWizard.tsx`: Tem botão "Baixar CSV de rejeitadas" (funciona)
  - `ImportarTab.tsx`: Mostra apenas mensagem "Verifique os erros antes de retentar" sem detalhes
- **Solução:** Adicionar lista visual expandível mostrando cada linha rejeitada com seu erro específico

---

## Alterações Técnicas

### Parte 1: Corrigir Botão "Agendar"

**Arquivo:** `src/pages/pessoas/Todos.tsx`

1. Importar o componente `AgendarContatoDialog`
2. Adicionar estados para controlar o diálogo:
   ```typescript
   const [agendarDialogOpen, setAgendarDialogOpen] = useState(false);
   const [pessoaSelecionada, setPessoaSelecionada] = useState<Pessoa | null>(null);
   ```
3. Substituir o `navigate` pelo handler:
   ```typescript
   onClick={() => {
     setPessoaSelecionada(pessoa);
     setAgendarDialogOpen(true);
   }}
   ```
4. Adicionar o diálogo no JSX:
   ```tsx
   <AgendarContatoDialog
     open={agendarDialogOpen}
     onOpenChange={setAgendarDialogOpen}
     visitanteId={pessoaSelecionada?.id || ""}
     visitanteNome={pessoaSelecionada?.nome || ""}
     onSuccess={() => {/* opcional: refetch contatos */}}
   />
   ```

### Parte 2: Adicionar Atalho para Contatos Agendados

**Arquivo:** `src/pages/pessoas/Todos.tsx`

Adicionar botão no header:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate("/pessoas/contatos")}
>
  <PhoneCall className="w-4 h-4 mr-2" />
  Contatos Agendados
</Button>
```

### Parte 3: Exibir Erros de Linhas Rejeitadas

**Arquivo:** `src/components/financas/ImportarTab.tsx`

1. Adicionar componente `Collapsible` de `@radix-ui/react-collapsible`
2. Após a mensagem "X linhas rejeitadas", adicionar lista expandível:
   ```tsx
   {rejected.length > 0 && (
     <Collapsible>
       <CollapsibleTrigger className="flex items-center gap-2 text-sm">
         <ChevronDown className="w-4 h-4" />
         Ver detalhes dos erros ({rejected.length})
       </CollapsibleTrigger>
       <CollapsibleContent>
         <ScrollArea className="max-h-48">
           {rejected.map((r) => (
             <div key={r.index} className="text-xs border-b py-1">
               <span className="font-medium">Linha {r.index + 2}:</span> {r.reason}
             </div>
           ))}
         </ScrollArea>
       </CollapsibleContent>
     </Collapsible>
   )}
   ```
3. Manter o botão "Baixar CSV" existente como opção adicional

---

## Integração com Relatório Pastoral (Futuro)

Conforme ADR-014, o sistema já possui a estrutura para vincular contatos ao gabinete pastoral:

- **Tabela `atendimentos_pastorais`:** Armazena tickets de cuidado pastoral
- **Tabela `visitante_contatos`:** Armazena follow-ups de equipe de recepção

**Opções para integração:**
1. **Registro automático:** Quando um contato for marcado como "Realizado" em `/pessoas/contatos`, criar entrada em relatório/log pastoral
2. **Promoção manual:** Botão "Encaminhar para Gabinete" que cria um `atendimento_pastoral` a partir do contato realizado
3. **Dashboard unificado:** Criar aba no Gabinete Pastoral que mostra histórico de contatos da pessoa

**Recomendação:** Implementar primeiro o fluxo básico (correção do botão) e depois discutir qual nível de integração com o gabinete pastoral faz sentido para o workflow da igreja.

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/pessoas/Todos.tsx` | Substituir navigate por AgendarContatoDialog + Adicionar atalho para /pessoas/contatos |
| `src/components/financas/ImportarTab.tsx` | Adicionar lista expandível de erros de linhas rejeitadas |

---

## Esclarecimentos

1. **A rota `/pessoas/contatos` existe** - está registrada no App.tsx e funciona
2. **O AgendarContatoDialog funciona com qualquer pessoa** - usa `visitante_id` mas aceita qualquer `profile.id`
3. **O ImportarExcelWizard já tem "Baixar CSV de rejeitadas"** - o ImportarTab precisa da mesma funcionalidade visual
