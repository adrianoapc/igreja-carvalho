# Verificação Manual do Certificado PFX

## Opção 1: Supabase SQL Editor (Mais Rápido)

1. Acesse: https://supabase.com/projects/[seu-project]/sql
2. Execute esta query SQL:

```sql
SELECT 
  integracao_id,
  client_id,
  pfx_blob,
  pfx_password
FROM integracoes_financeiras_secrets
WHERE integracao_id = '378467d2-8d48-43de-87c6-fcf675c27c86';
```

3. Copie o valor de `pfx_blob` completo
4. Use um decodificador online ou local para converter de base64 para binário

## Opção 2: OpenSSL (Se tiver arquivo .pfx)

```bash
# Se já tiver o arquivo pfx:
openssl pkcs12 -in certificado.pfx -text -passin pass:SENHA

# Isso vai exibir:
# - Subject: CN=..., O=..., CNPJ=...
# - Validity (datas de validade)
# - Serial Number
```

## Opção 3: Usar a Edge Function (Quando estiver deployada)

```bash
curl -X POST https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/debug-certificate \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "integracao_id": "378467d2-8d48-43de-87c6-fcf675c27c86"
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "certificate": {
    "subject": {
      "commonName": "...",
      "organizationName": "...",
      "organizationalUnitName": "...",
      "countryName": "BR"
    },
    "issuer": {...},
    "validFrom": "2024-01-15T00:00:00Z",
    "validTo": "2025-01-15T00:00:00Z",
    "isExpired": false,
    "daysUntilExpiry": 365,
    "serialNumber": "...",
    "thumbprint": "..."
  }
}
```

## O que procurar no certificado:

- **CNPJ**: Geralmente em `subject.organizationName` ou como extensão
- **Validade**: `validFrom` e `validTo`
- **Expired?**: `isExpired`
- **Dias até expirar**: `daysUntilExpiry`
- **Empresa**: `subject.organizationName`
- **CN (Common Name)**: `subject.commonName`

## Próximos passos:

1. Verifique se o certificado está válido (não expirado)
2. Verifique se o CNPJ no certificado corresponde à sua empresa
3. Verifique se foi configurado corretamente em Santander (sandbox ou production)
4. Se o certificado estiver inválido, substitua por um novo
