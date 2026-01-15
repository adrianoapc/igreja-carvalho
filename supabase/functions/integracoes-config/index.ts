// supabase/functions/integracoes-config/index.ts
// Edge Function para criar integrações financeiras + secrets com criptografia XSalsa20-Poly1305

import { createClient } from 'npm:@supabase/supabase-js@2'
import nacl from 'npm:tweetnacl@1.0.3'
import { encodeBase64, decodeBase64 } from 'npm:tweetnacl-util@0.15.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CreateIntegracaoPayload = {
  action: 'create_integracao'
  igreja_id: string
  filial_id?: string | null
  provedor: string
  cnpj: string
  ativo?: boolean

  // credenciais (opcionais, dependendo do provedor)
  client_id?: string | null
  client_secret?: string | null
  application_key?: string | null

  // PFX (base64)
  pfx_blob?: string | null
  pfx_password?: string | null
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ==================== ENCRYPTION UTILITIES ====================

/**
 * Deriva uma chave de 32 bytes a partir da ENCRYPTION_KEY.
 * Suporta hex (64 chars) ou base64 (44 chars).
 */
function deriveKey(masterKey: string): Uint8Array {
  const trimmed = masterKey.trim()
  
  // Se for hex (64 caracteres = 32 bytes em hex)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }
  
  // Se for base64 (44 chars = 32 bytes em base64)
  if (/^[A-Za-z0-9+/]{43}=?$/.test(trimmed) || /^[A-Za-z0-9+/]{44}$/.test(trimmed)) {
    return decodeBase64(trimmed)
  }
  
  // Fallback: usar os primeiros 32 bytes do UTF-8 (padded com zeros)
  const encoder = new TextEncoder()
  const encoded = encoder.encode(trimmed)
  const key = new Uint8Array(32)
  key.set(encoded.slice(0, 32))
  return key
}

/**
 * Criptografa dados usando XSalsa20-Poly1305 (secretbox).
 * Retorna base64(nonce || ciphertext).
 */
function encryptData(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength) // 24 bytes
  const messageBytes = new TextEncoder().encode(plaintext)
  const ciphertext = nacl.secretbox(messageBytes, nonce, key)
  
  // Concatena nonce + ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce, 0)
  combined.set(ciphertext, nonce.length)
  
  return encodeBase64(combined)
}

// ==================== PERMISSION VALIDATION ====================

async function validatePermissions(supabaseAdmin: any, userId: string, igrejaId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('igreja_id', igrejaId)
    .in('role', ['admin', 'tesoureiro'])
    .maybeSingle()

  return !error && !!data
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('[integracoes-config] Missing Supabase env vars')
      return json(500, { error: 'Server misconfigured' })
    }

    if (!encryptionKey) {
      console.error('[integracoes-config] ENCRYPTION_KEY not configured')
      return json(500, { error: 'Encryption not configured' })
    }

    const derivedKey = deriveKey(encryptionKey)
    console.log('[integracoes-config] Encryption key derived successfully')

    const token = authHeader.replace('Bearer ', '')

    // 1) Validar JWT e obter userId
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      console.warn('[integracoes-config] Invalid token', claimsError)
      return json(401, { error: 'Unauthorized' })
    }

    const userId = claimsData.claims.sub

    // 2) Parse payload
    const payload = (await req.json().catch(() => null)) as CreateIntegracaoPayload | null
    if (!payload) return json(400, { error: 'Invalid JSON body' })
    if (payload.action !== 'create_integracao') return json(400, { error: 'Invalid action' })

    const igreja_id = payload.igreja_id
    const filial_id = payload.filial_id ?? null
    const provedor = (payload.provedor ?? '').trim()
    const cnpj = (payload.cnpj ?? '').trim()

    if (!igreja_id || !provedor || !cnpj) {
      return json(400, { error: 'Missing required fields: igreja_id, provedor, cnpj' })
    }

    // Validação básica CNPJ (com ou sem máscara)
    if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/.test(cnpj)) {
      return json(400, { error: 'Invalid CNPJ format' })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // 3) Autorização (admin/tesoureiro)
    const hasPermission = await validatePermissions(supabaseAdmin, userId, igreja_id)
    if (!hasPermission) return json(403, { error: 'Insufficient permissions' })

    // 4) Criar integração (service role)
    const status = payload.ativo === false ? 'inativo' : 'ativo'

    const { data: integracao, error: integracaoError } = await supabaseAdmin
      .from('integracoes_financeiras')
      .insert({
        igreja_id,
        filial_id,
        cnpj: cnpj.replace(/\D/g, ''),
        provedor,
        status,
        config: {
          created_by: userId,
        },
      })
      .select('id, igreja_id, filial_id, cnpj, provedor, status, config, created_at, updated_at')
      .single()

    if (integracaoError || !integracao) {
      console.error('[integracoes-config] Error creating integration', integracaoError)
      return json(500, { error: 'Failed to create integration' })
    }

    // 5) Persistir secrets CRIPTOGRAFADOS (service role). Nunca retornar secrets.
    const hasSecrets =
      payload.client_id ||
      payload.client_secret ||
      payload.application_key ||
      payload.pfx_blob ||
      payload.pfx_password

    if (hasSecrets) {
      console.log('[integracoes-config] Encrypting sensitive credentials...')

      // Criptografar cada campo sensível
      const encryptedClientId = payload.client_id 
        ? encryptData(payload.client_id, derivedKey) 
        : null
      
      const encryptedClientSecret = payload.client_secret 
        ? encryptData(payload.client_secret, derivedKey) 
        : null
      
      const encryptedApplicationKey = payload.application_key 
        ? encryptData(payload.application_key, derivedKey) 
        : null
      
      const encryptedPfxPassword = payload.pfx_password 
        ? encryptData(payload.pfx_password, derivedKey) 
        : null
      
      // PFX blob já vem como base64, criptografamos a string base64
      const encryptedPfxBlob = payload.pfx_blob 
        ? encryptData(payload.pfx_blob, derivedKey) 
        : null

      const { error: secretsError } = await supabaseAdmin.from('integracoes_financeiras_secrets').insert({
        integracao_id: integracao.id,
        pfx_blob: encryptedPfxBlob,
        pfx_password: encryptedPfxPassword,
        client_id: encryptedClientId,
        client_secret: encryptedClientSecret,
        application_key: encryptedApplicationKey,
      })

      if (secretsError) {
        console.error('[integracoes-config] Error storing encrypted secrets', secretsError)
        // rollback best-effort
        await supabaseAdmin.from('integracoes_financeiras').delete().eq('id', integracao.id)
        return json(500, { error: 'Failed to store credentials securely' })
      }

      console.log('[integracoes-config] Secrets encrypted and stored successfully')
    }

    return json(201, { success: true, integracao })
  } catch (e: unknown) {
    console.error('[integracoes-config] Unhandled error', e)
    return json(500, { error: 'Internal server error' })
  }
})
