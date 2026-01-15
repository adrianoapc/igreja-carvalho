// supabase/functions/integracoes-config/index.ts
// Edge Function para criar integrações financeiras + secrets (acesso somente via service role)

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as nacl from 'npm:tweetnacl@1.0.3'
import { encodeBase64, decodeBase64 } from 'npm:tweetnacl-util@0.5.2'

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

async function validatePermissions(supabaseAdmin: any, userId: string, igrejaId: string) {
  // Mantém compatibilidade com o projeto atual (tabela user_roles)
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('igreja_id', igrejaId)
    .in('role', ['admin', 'tesoureiro'])
    .maybeSingle()

  return !error && !!data
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes
}

/**
 * Encriptar dados usando XSalsa20-Poly1305 (tweetnacl)
 * Retorna: base64(nonce || ciphertext)
 */
function encryptData(data: string, key: Uint8Array): string {
  if (data.length === 0) return ''

  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const message = new TextEncoder().encode(data)

  const encrypted = nacl.secretbox(message, nonce, key)
  if (!encrypted) throw new Error('Encryption failed')

  // Concatenar nonce + ciphertext
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, nonce.length)

  return encodeBase64(combined)
}

/**
 * Derivar chave a partir de ENCRYPTION_KEY env var
 * Retorna 32 bytes (256 bits)
 */
function deriveKey(masterKeyHex: string): Uint8Array {
  // Se a chave é em hex, converter para bytes
  if (masterKeyHex.length === 64) {
    const key = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      key[i] = parseInt(masterKeyHex.substr(i * 2, 2), 16)
    }
    return key
  }

  // Fallback: usar a string como base64
  try {
    return decodeBase64(masterKeyHex)
  } catch {
    // Último fallback: usar SHA256 da string (simples, não ideal)
    throw new Error('ENCRYPTION_KEY deve ser 64 chars em hex ou 44 chars em base64')
  }
}

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

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('[integracoes-config] Missing env vars', {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnonKey,
        hasService: !!serviceKey,
      })
      return json(500, { error: 'Server misconfigured' })
    }

    const token = authHeader.replace('Bearer ', '')

    // 1) Validar JWT e obter userId (não depende de sessão)
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

    // 5) Persistir secrets (service role). Nunca retornar secrets.
    const hasSecrets =
      payload.client_id ||
      payload.client_secret ||
      payload.application_key ||
      payload.pfx_blob ||
      payload.pfx_password

    if (hasSecrets) {
      const encryptionKeyHex = Deno.env.get('ENCRYPTION_KEY')
      if (!encryptionKeyHex) {
        console.error('[integracoes-config] ENCRYPTION_KEY not configured')
        await supabaseAdmin.from('integracoes_financeiras').delete().eq('id', integracao.id)
        return json(500, { error: 'Encryption not configured on server' })
      }

      try {
        const encryptionKey = deriveKey(encryptionKeyHex)

        // Criptografar cada campo sensível
        const encryptedClientId = payload.client_id ? encryptData(payload.client_id, encryptionKey) : null
        const encryptedClientSecret = payload.client_secret
          ? encryptData(payload.client_secret, encryptionKey)
          : null
        const encryptedApplicationKey = payload.application_key
          ? encryptData(payload.application_key, encryptionKey)
          : null
        const encryptedPfxPassword = payload.pfx_password
          ? encryptData(payload.pfx_password, encryptionKey)
          : null
        const encryptedPfxBlob = payload.pfx_blob
          ? encryptData(payload.pfx_blob, encryptionKey)
          : null

        const { error: secretsError } = await supabaseAdmin
          .from('integracoes_financeiras_secrets')
          .insert({
            integracao_id: integracao.id,
            pfx_blob: encryptedPfxBlob,
            pfx_password: encryptedPfxPassword,
            client_id: encryptedClientId,
            client_secret: encryptedClientSecret,
            application_key: encryptedApplicationKey,
          })

        if (secretsError) {
          console.error('[integracoes-config] Error storing secrets', secretsError)
          await supabaseAdmin.from('integracoes_financeiras').delete().eq('id', integracao.id)
          return json(500, { error: 'Failed to store credentials securely' })
        }
      } catch (encryptError) {
        console.error('[integracoes-config] Encryption error', encryptError)
        await supabaseAdmin.from('integracoes_financeiras').delete().eq('id', integracao.id)
        return json(500, { error: 'Encryption failed' })
      }
    }

    return json(201, { success: true, integracao })
  } catch (e: unknown) {
    console.error('[integracoes-config] Unhandled error', e)
    return json(500, { error: 'Internal server error' })
  }
})
