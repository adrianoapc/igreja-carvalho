# Diagrama de Sequencia - Processo Financeiro

## Objetivo
Detalhar a ordem cronológica dos eventos em um ciclo financeiro completo, desde o registro do fato gerador até a conciliação bancária e atualização do DRE.

## Contexto
Este diagrama representa o fluxo feliz (sem erros) de uma despesa com reembolso. Para variações (estornos, parcelamentos, conciliação com divergência), consulte os cenários na seção abaixo.

## Sequência Padrão (Fluxo Feliz)

Sequência temporal dos eventos financeiros, do upload até a conciliação, seguindo o modelo do ADR-001. Referências: [`../adr/ADR-001-separacao-fato-gerador-caixa-dre.md`](../adr/ADR-001-separacao-fato-gerador-caixa-dre.md) e [`../manual-usuario.md`](../manual-usuario.md).

```mermaid
sequenceDiagram
    autonumber

    participant Lider as Lider
    participant Sistema as Sistema
    participant Tesoureiro as Tesoureiro
    participant Banco as Banco

    Lider->>Sistema: Envia notas fiscais (upload)
    Sistema->>Sistema: Classifica e agrupa itens
    Sistema->>Tesoureiro: Solicita aprovacao
    Tesoureiro->>Sistema: Aprova pagamento
    Sistema->>Banco: Executa pagamento (PIX ou transferencia)
    Banco-->>Sistema: Retorna extrato
    Sistema->>Sistema: Concilia pagamento
    Sistema-->>Lider: Atualiza status pago

```

---

## Detalhamento dos Passos

### 1. Upload de Notas Fiscais
- **Ator**: Líder ou membro que fez a compra
- **Ação**: Upload de imagem/PDF da nota fiscal
- **Sistema**: IA (Gemini) extrai dados automaticamente
- **Resultado**: Fato gerador criado com categoria, fornecedor e valor

### 2. Classificação e Agrupamento
- **Sistema**: Agrupa múltiplas notas em uma solicitação
- **Sistema**: Sugere categoria com base em histórico do fornecedor
- **Resultado**: Solicitação de reembolso pronta para aprovação

### 3. Aprovação do Tesoureiro
- **Ator**: Tesoureiro ou administrador financeiro
- **Ação**: Revisa categoria, valor e fornecedor
- **Decisão**: Aprova, rejeita ou solicita ajuste
- **Resultado**: Se aprovado, avança para pagamento

### 4. Execução do Pagamento
- **Sistema**: Gera transação de caixa
- **Tesoureiro**: Escolhe forma de pagamento e conta origem
- **Banco**: Processa transferência/PIX
- **Resultado**: Dinheiro sai da conta da igreja

### 5. Retorno do Extrato Bancário
- **Banco**: Envia extrato (API ou importação manual)
- **Sistema**: Compara lançamento previsto vs extrato
- **Resultado**: Transação marcada como "Pendente de Conciliação"

### 6. Conciliação
- **Sistema**: Valida se valor e data batem
- **Se bate**: Marca como "Conciliado" e atualiza status para "Pago"
- **Se não bate**: Alerta tesoureiro para verificação manual

### 7. Atualização de Status
- **Sistema**: Notifica líder que o reembolso foi pago
- **Sistema**: Atualiza DRE com o valor na categoria correta
- **Resultado**: Ciclo completo

---

## Variações do Fluxo

### Variação A: Estorno de Fato Gerador
```mermaid
sequenceDiagram
    autonumber
    participant Tesoureiro
    participant Sistema
    participant DB

    Tesoureiro->>Sistema: Solicita estorno de fato gerador
    Sistema->>Tesoureiro: Pede justificativa
    Tesoureiro->>Sistema: Informa motivo
    Sistema->>DB: Marca fato gerador como estornado
    Sistema->>DB: Remove lançamento do DRE
    Sistema-->>Tesoureiro: Confirma estorno

    Note over Sistema: Caixa não é revertido automaticamente
    Note over Sistema: Requer estorno de pagamento separado
```

### Variação B: Estorno de Pagamento (sem alterar fato gerador)
```mermaid
sequenceDiagram
    autonumber
    participant Tesoureiro
    participant Sistema
    participant Banco

    Tesoureiro->>Sistema: Solicita estorno de pagamento
    Sistema->>Tesoureiro: Pede justificativa
    Tesoureiro->>Sistema: Informa motivo
    Sistema->>Banco: Reverte transação (se possível)
    Sistema->>Sistema: Atualiza saldo da conta
    Sistema-->>Tesoureiro: Confirma estorno

    Note over Sistema: DRE permanece inalterado
    Note over Sistema: Fato gerador continua válido
```

### Variação C: Pagamento Parcelado
```mermaid
sequenceDiagram
    autonumber
    participant Tesoureiro
    participant Sistema
    participant Banco

    Tesoureiro->>Sistema: Aprova pagamento parcelado 3x
    Sistema->>Sistema: Cria 3 transações de caixa agendadas
    Sistema->>Banco: Executa parcela 1
    Banco-->>Sistema: Confirma pagamento
    Sistema->>Sistema: Aguarda próximo mês
    Sistema->>Banco: Executa parcela 2
    Banco-->>Sistema: Confirma pagamento
    Sistema->>Sistema: Aguarda próximo mês
    Sistema->>Banco: Executa parcela 3
    Banco-->>Sistema: Confirma pagamento
    Sistema-->>Tesoureiro: Pagamento completo

    Note over Sistema: DRE registra valor total no mês 1
    Note over Sistema: Caixa registra -R$ parcial por mês
```

### Variação D: Conciliação com Divergência
```mermaid
sequenceDiagram
    autonumber
    participant Banco
    participant Sistema
    participant Tesoureiro

    Banco->>Sistema: Retorna extrato
    Sistema->>Sistema: Compara previsto vs extrato
    Sistema->>Sistema: Identifica divergência (taxa bancária)
    Sistema-->>Tesoureiro: Alerta de divergência
    Tesoureiro->>Sistema: Ajusta lançamento (inclui taxa)
    Sistema->>Sistema: Marca como conciliado
    Sistema-->>Tesoureiro: Conciliação completa

    Note over Sistema: Taxa bancária é ajuste de caixa
    Note over Sistema: Não altera o DRE original
```

---

## Referências

- **Decisão Arquitetural**: [ADR-001 - Separação Fato Gerador vs Caixa vs DRE](../adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
- **Funcionalidades Detalhadas**: [Módulo Financeiro](../funcionalidades.md#2-módulo-financeiro)
- **Guia do Usuário**: [Manual - Seção Financeiro](../manual-usuario.md#4-módulo-financeiro)
- **Fluxo Macro**: [Diagrama de Fluxo Financeiro](fluxo-financeiro.md)
- **Composição do DRE**: [Diagrama DRE](dre.md)
