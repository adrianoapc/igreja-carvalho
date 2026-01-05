# Replicação de cadastros entre filiais

A replicação permite copiar cadastros financeiros entre filiais da mesma igreja, evitando retrabalho em configurações recorrentes.

## Como funciona

- A operação parte de uma **filial origem** e replica para **filiais destino**.
- Somente tabelas permitidas são copiadas (contas, centros de custo, categorias, subcategorias, fornecedores, formas de pagamento e bases ministeriais).
- Apenas **registros ativos** são replicados.
- Contas com tipo "tesouraria" são ignoradas por compatibilidade operacional.
- O comportamento de deduplicação pode ser configurado:
  - **Ignorar**: mantém registros existentes e replica apenas os novos.
  - **Substituir**: atualiza registros existentes com os dados da filial origem.

## Auditoria

Cada replicação gera um registro em `logs_auditoria_replicacao`, contendo:

- `user_id`
- `igreja_id`
- `filial_origem_id`
- `filiais_destino_ids`
- `tabelas`
- `resultado`

Use esse log para acompanhar resultados e diagnósticos.

## Requisitos

- Apenas perfis com papel `admin_igreja`, `admin` ou `super_admin` podem executar a replicação.
- É necessário selecionar ao menos uma filial destino e uma tabela para replicar.
