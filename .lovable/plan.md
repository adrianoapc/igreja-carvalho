

# Plano: Corrigir Parsing de Data e Adicionar Download de Erros na Validação

## Problema 1: Data importando com 1 dia a menos

### Causa Raiz
A biblioteca `xlsx` pode converter células formatadas como "Data" no Excel para **serial date** (número), mesmo quando o conteúdo visual é `dd/MM/yyyy`. Quando isso acontece, o parsing atual pode ter imprecisões de timezone.

### Solução
Forçar o `xlsx` a ler todas as células como texto bruto usando a opção `raw: false` e `dateNF: undefined` ao parsear a planilha. Isso evita a conversão automática para serial date.

**Arquivo:** `src/components/financas/ImportarTab.tsx`

**Alteração na função `parseSheet` (linha ~166-191):**

```typescript
const parseSheet = (wb: WorkBook, sheetName: string) => {
  try {
    const worksheet = wb.Sheets[sheetName];
    // Forçar leitura como texto para evitar conversão automática de datas
    const jsonData = utils.sheet_to_json(worksheet, { 
      defval: "",
      raw: false,  // <-- Força formato de exibição em vez de valor bruto
      dateNF: "dd/mm/yyyy"  // <-- Formato de data esperado
    });
    // ... resto do código
  }
};
```

**Impacto:** Datas que antes vinham como `45936` (serial) agora virão como `"05/10/2025"` (string), sendo parseadas corretamente pelo regex existente.

---

## Problema 2: Botão de download de erros sumiu

### Causa Raiz
O botão "Baixar CSV" só aparece no **step 3** (importação em progresso), dentro do bloco `{rejected.length > 0}`. Na etapa de **validação (step 2)**, os erros são exibidos mas não há opção de download.

### Solução
Adicionar botão de download também na seção de validação (step 2).

**Arquivo:** `src/components/financas/ImportarTab.tsx`

**Alteração no step 2 (linhas ~1277-1290):**

Adicionar botão de download junto aos botões "Desmarcar todos" e "Marcar todos":

```tsx
{step === 2 && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-sm">
        Resumo de Validação ({validationIssues.length} problemas)
      </h3>
      {validationIssues.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const csvContent = validationIssues
              .map((issue) => 
                `${issue.index + 2},"${issue.messages.join("; ").replace(/"/g, '""')}"`
              )
              .join("\n");
            const blob = new Blob(
              [`Linha,Problemas\n${csvContent}`],
              { type: "text/csv;charset=utf-8;" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "erros_validacao.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="w-4 h-4 mr-1" />
          Baixar Erros
        </Button>
      )}
    </div>
    {/* ... resto do conteúdo de validação */}
  </div>
)}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `ImportarTab.tsx` | Adicionar `raw: false` no `sheet_to_json` para evitar conversão automática de datas |
| `ImportarTab.tsx` | Adicionar botão "Baixar Erros" na etapa de validação (step 2) |
| `ImportarExcelWizard.tsx` | Mesmas correções (consistência entre componentes) |

---

## Por que não precisa de reset?

O código está funcional — apenas falta:
1. **Robustez no parsing**: Evitar que o xlsx converta datas automaticamente
2. **UX de download**: Adicionar botão que já existe no step 3 também no step 2

Essas são alterações pontuais que não afetam o estado da aplicação ou banco de dados.

