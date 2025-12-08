#!/bin/bash

echo "================================================"
echo "🚀 Aplicando migração kids_checkins no Supabase"
echo "================================================"
echo ""

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "📥 Instalando Supabase CLI..."
    brew install supabase/tap/supabase
fi

echo "📁 Aplicando migration..."
supabase db push

echo ""
echo "✅ Migration aplicada com sucesso!"
echo ""
echo "🔄 Gerando tipos TypeScript atualizados..."
supabase gen types typescript --local > src/integrations/supabase/types.ts

echo ""
echo "================================================"
echo "✨ Processo concluído!"
echo "================================================"
echo ""
echo "📝 Próximos passos:"
echo "  1. Verifique se não há erros de TypeScript"
echo "  2. Teste o fluxo completo: Scanner → Check-in → FamilyWallet"
echo "  3. Teste o check-out pelo FamilyWallet"
echo ""
