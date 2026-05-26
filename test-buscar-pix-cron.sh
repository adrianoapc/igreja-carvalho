#!/bin/bash
# Script para testar manualmente o cron de busca de PIX
# Uso: ./test-buscar-pix-cron.sh

set -e

echo "🔍 Testando Edge Function buscar-pix-cron..."
echo ""

# Carregar variáveis de ambiente do .env.local se existir
if [ -f .env.local ]; then
  source .env.local
fi

# Verificar se as variáveis estão definidas
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidas"
  echo "   Defina-as no arquivo .env.local ou como variáveis de ambiente"
  exit 1
fi

# Chamar a Edge Function
echo "📡 Chamando: $SUPABASE_URL/functions/v1/buscar-pix-cron"
echo ""

response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  "$SUPABASE_URL/functions/v1/buscar-pix-cron" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

# Separar body e status code
http_body=$(echo "$response" | head -n -1)
http_code=$(echo "$response" | tail -n 1)

echo "📊 Status HTTP: $http_code"
echo ""
echo "📄 Resposta:"
echo "$http_body" | jq '.' 2>/dev/null || echo "$http_body"
echo ""

if [ "$http_code" -eq 200 ]; then
  echo "✅ Função executada com sucesso!"
  
  # Extrair estatísticas se disponíveis
  importados=$(echo "$http_body" | jq -r '.importados // 0' 2>/dev/null)
  duplicados=$(echo "$http_body" | jq -r '.duplicados // 0' 2>/dev/null)
  
  echo "   • PIX importados: $importados"
  echo "   • PIX duplicados: $duplicados"
else
  echo "❌ Erro ao executar função (HTTP $http_code)"
  exit 1
fi
