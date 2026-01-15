// supabase/functions/test-santander/index.ts
/**
 * Edge Function para testar conexão com API Santander
 * 
 * Busca integração Santander do banco, descriptografa credenciais
 * e valida conexão com API sem persistir nada
 * 
 * POST /functions/v1/test-santander
 * Body: {
 *   integracao_id: string
 *   banco_id: string (e.g., "033")
 *   agencia: string (e.g., "0001")
 *   conta: string (e.g., "1234567")
 *   data_inicio?: string (YYYY-MM-DD, default: 30 dias atrás)
 *   data_fim?: string (YYYY-MM-DD, default: hoje)
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import nacl from 'npm:tweetnacl@1.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SANTANDER_TOKEN_URL = 'https://trust-open.api.santander.com.br/auth/oauth/v2/token'
const SANTANDER_BASE_URL = 'https://trust-open.api.santander.com.br/bank_account_information/v1'

// ==================== ENCRYPTION UTILITIES ====================

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes
}

function deriveKey(masterKey: string): Uint8Array {
  const trimmed = masterKey.trim()

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  if (/^[A-Za-z0-9+/]{43}=?$/.test(trimmed) || /^[A-Za-z0-9+/]{44}$/.test(trimmed)) {
    const decoded = base64ToUint8Array(trimmed)
    if (decoded.length === 32) return decoded
    const key = new Uint8Array(32)
    key.set(decoded.slice(0, 32))
    return key
  }

  const encoded = new TextEncoder().encode(trimmed)
  const key = new Uint8Array(32)
  key.set(encoded.slice(0, 32))
  return key
}

/**
 * Descriptografa dados usando XSalsa20-Poly1305.
 * Esperado: base64(nonce || ciphertext)
 */
function decryptData(encrypted: string, key: Uint8Array): string {
  try {
    const combined = base64ToUint8Array(encrypted)
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)

    const decrypted = nacl.secretbox.open(ciphertext, nonce, key)
    if (!decrypted) {
      throw new Error('Decryption failed')
    }

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    throw new Error(`Decryption error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// ==================== RESPONSE HELPERS ====================

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // DEBUG MODE: permite testes sem autenticação
    const debugMode = Deno.env.get('TEST_SANTANDER_DEBUG') === 'true'
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    
    if (!debugMode && !authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    if (debugMode) {
      console.log('[test-santander] Running in DEBUG MODE - auth bypassed')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('[test-santander] Missing Supabase env vars')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    if (!encryptionKey) {
      console.error('[test-santander] ENCRYPTION_KEY not configured')
      return jsonResponse({ error: 'Encryption not configured' }, 500)
    }

    // Parse payload
    const payload = await req.json()
    const { integracao_id, banco_id, agencia, conta, data_inicio, data_fim } = payload

    if (!integracao_id || !banco_id || !agencia || !conta) {
      return jsonResponse(
        { error: 'Missing required fields: integracao_id, banco_id, agencia, conta' },
        400,
      )
    }

    console.log('[test-santander] Starting test for integração:', integracao_id)

    // Fetch integration + secrets
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { data: integracao, error: integError } = await supabaseAdmin
      .from('integracoes_financeiras')
      .select('*')
      .eq('id', integracao_id)
      .single()

    if (integError || !integracao) {
      console.error('[test-santander] Integration not found:', integError)
      return jsonResponse({ error: 'Integração não encontrada' }, 404)
    }

    if (integracao.provedor !== 'santander') {
      return jsonResponse({ error: 'Esta função é apenas para Santander' }, 400)
    }

    console.log('[test-santander] Found integration:', integracao.id)

    // Fetch secrets
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from('integracoes_financeiras_secrets')
      .select('*')
      .eq('integracao_id', integracao_id)
      .single()

    if (secretsError || !secrets) {
      console.error('[test-santander] Secrets not found:', secretsError)
      return jsonResponse({ error: 'Credenciais não encontradas' }, 404)
    }

    console.log('[test-santander] Found secrets for integração')

    // Decrypt credentials
    const derivedKey = deriveKey(encryptionKey)

    let clientId: string | null = null
    let clientSecret: string | null = null
    let pfxBlob: string | null = null
    let pfxPassword: string | null = null

    try {
      if (secrets.client_id) {
        clientId = decryptData(secrets.client_id, derivedKey)
      }
      if (secrets.client_secret) {
        clientSecret = decryptData(secrets.client_secret, derivedKey)
      }
      if (secrets.pfx_blob) {
        pfxBlob = decryptData(secrets.pfx_blob, derivedKey)
      }
      if (secrets.pfx_password) {
        pfxPassword = decryptData(secrets.pfx_password, derivedKey)
      }
    } catch (error) {
      console.error('[test-santander] Decryption failed:', error)
      return jsonResponse({ error: `Decryption failed: ${error instanceof Error ? error.message : String(error)}` }, 500)
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Client ID or Secret not found in decrypted data' }, 400)
    }

    console.log('[test-santander] Credentials decrypted successfully')

    // Get OAuth2 token
    console.log('[test-santander] Requesting OAuth2 token...')

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString()

    const tokenResponse = await fetch(SANTANDER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody,
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[test-santander] Token request failed:', tokenResponse.status, errorText)
      return jsonResponse(
        {
          error: 'Token request failed',
          status: tokenResponse.status,
          detail: errorText,
        },
        tokenResponse.status,
      )
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      console.error('[test-santander] No access_token in response')
      return jsonResponse({ error: 'No access_token in response', detail: tokenData }, 400)
    }

    console.log('[test-santander] Token obtained successfully')

    const token = tokenData.access_token

    // Query balance
    console.log('[test-santander] Querying balance...')

    const balanceUrl = `${SANTANDER_BASE_URL}/banks/${banco_id}/balances/${agencia}.${conta}`
    const balanceResponse = await fetch(balanceUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    let balance = null
    let balanceError = null

    if (balanceResponse.ok) {
      balance = await balanceResponse.json()
      console.log('[test-santander] Balance query successful')
    } else {
      const errorText = await balanceResponse.text()
      console.warn('[test-santander] Balance query failed:', balanceResponse.status)
      balanceError = {
        status: balanceResponse.status,
        detail: errorText,
      }
    }

    // Query statement
    console.log('[test-santander] Querying statement...')

    const statementUrl = new URL(
      `${SANTANDER_BASE_URL}/banks/${banco_id}/statements/${agencia}.${conta}`,
    )

    // Date range: default to last 30 days
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    statementUrl.searchParams.set('initialDate', data_inicio || formatDate(thirtyDaysAgo))
    statementUrl.searchParams.set('finalDate', data_fim || formatDate(today))
    statementUrl.searchParams.set('_offset', '0')
    statementUrl.searchParams.set('_limit', '10')

    const statementResponse = await fetch(statementUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    let statement = null
    let statementError = null

    if (statementResponse.ok) {
      statement = await statementResponse.json()
      console.log('[test-santander] Statement query successful, got', Array.isArray(statement) ? statement.length : 0, 'records')
    } else {
      const errorText = await statementResponse.text()
      console.warn('[test-santander] Statement query failed:', statementResponse.status)
      statementError = {
        status: statementResponse.status,
        detail: errorText,
      }
    }

    // Return results (WITHOUT returning sensitive data)
    return jsonResponse({
      success: true,
      teste: {
        integracao_id,
        provedor: integracao.provedor,
        banco_id,
        agencia,
        conta,
        timestamp: new Date().toISOString(),
      },
      token: {
        obtained: !!token,
        type: tokenData.token_type,
        expires_in: tokenData.expires_in,
      },
      balance: balance ? { obtained: true, data: balance } : { obtained: false, error: balanceError },
      statement: statement
        ? {
            obtained: true,
            count: Array.isArray(statement) ? statement.length : 0,
            data: statement,
          }
        : {
            obtained: false,
            error: statementError,
          },
    })
  } catch (error) {
    console.error('[test-santander] Unhandled error:', error)
    return jsonResponse(
      {
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
