// supabase/functions/santander-api/index.ts
/**
 * Edge Function para integração com API Santander
 * 
 * Suporta múltiplas ações:
 * - saldo: Consulta saldo da conta
 * - extrato: Consulta extrato sem persistir
 * - sync: Sincroniza extrato para extratos_bancarios
 * 
 * POST /functions/v1/santander-api
 * Body: {
 *   action: 'saldo' | 'extrato' | 'sync'
 *   integracao_id: string
 *   conta_id: string          // ID da conta no sistema
 *   data_inicio?: string      // YYYY-MM-DD
 *   data_fim?: string         // YYYY-MM-DD
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import nacl from 'npm:tweetnacl@1.0.3'
import forge from 'npm:node-forge@1.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SANTANDER_TOKEN_URL = 'https://trust-open.api.santander.com.br/auth/oauth/v2/token'
const SANTANDER_BASE_URL = 'https://trust-open.api.santander.com.br/bank_account_information/v1'

// Roles autorizadas para operações bancárias
const AUTHORIZED_ROLES = ['super_admin', 'admin', 'admin_igreja', 'tesoureiro']

// ==================== ENCRYPTION UTILITIES ====================

function base64ToUint8Array(base64: string): Uint8Array {
  try {
    let normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
    while (normalized.length % 4) {
      normalized += '='
    }
    const binaryString = atob(normalized)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    return bytes
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`)
  }
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

function byteaToString(value: unknown): string {
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      try {
        const hexStr = value.slice(2)
        const bytes = new Uint8Array(hexStr.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16)
        }
        return new TextDecoder().decode(bytes)
      } catch (err) {
        console.warn('[santander-api] Failed to decode hex bytea:', err)
        return value
      }
    }
    return value
  }
  
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value)
  }
  
  if (value instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(value))
  }
  
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.data)) {
      const bytes = new Uint8Array(obj.data as number[])
      return new TextDecoder().decode(bytes)
    }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      const bytes = new Uint8Array(obj.data as number[])
      return new TextDecoder().decode(bytes)
    }
  }
  
  return String(value)
}

function decryptData(encrypted: unknown, key: Uint8Array): string {
  const encryptedStr = byteaToString(encrypted)
  
  try {
    if (encryptedStr.startsWith('{') && encryptedStr.includes('"data":[')) {
      try {
        const parsed = JSON.parse(encryptedStr)
        if (Array.isArray(parsed.data)) {
          const bytes = new Uint8Array(parsed.data)
          return new TextDecoder().decode(bytes)
        }
      } catch {
        // Não é JSON válido, continua com decryption
      }
    }

    const combined = base64ToUint8Array(encryptedStr)
    
    if (combined.length < 25) {
      console.log('[santander-api] Data too short to be encrypted, returning as-is')
      return encryptedStr
    }
    
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)

    const decrypted = nacl.secretbox.open(ciphertext, nonce, key)
    if (!decrypted) {
      console.warn('[santander-api] Decryption failed, trying as plain text')
      return encryptedStr
    }

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.warn('[santander-api] Base64 decode failed, returning original:', error)
    return encryptedStr
  }
}

function pfxToPem(pfxData: string, password?: string): { cert: string; key: string } {
  try {
    let pfxDer: string
    
    if (pfxData.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(pfxData)
        if (Array.isArray(parsed.data)) {
          const uint8 = new Uint8Array(parsed.data)
          let binary = ''
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i])
          }
          pfxDer = binary
        } else {
          throw new Error('JSON does not contain data array')
        }
      } catch (err) {
        throw new Error(`Invalid JSON PFX: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (/^[A-Za-z0-9+/]*={0,2}$/.test(pfxData)) {
      pfxDer = forge.util.decode64(pfxData)
    } else {
      try {
        pfxDer = forge.util.decode64(btoa(unescape(encodeURIComponent(pfxData))))
      } catch {
        pfxDer = pfxData
      }
    }
    
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password || '')

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag?.cert) {
      throw new Error('Certificate not found in PFX')
    }
    const cert = forge.pki.certificateToPem(certBag.cert)

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag?.key) {
      throw new Error('Private key not found in PFX')
    }
    const key = forge.pki.privateKeyToPem(keyBag.key)

    return { cert, key }
  } catch (error) {
    throw new Error(`PFX conversion failed: ${error instanceof Error ? error.message : String(error)}`)
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

// ==================== AUTHORIZATION ====================

interface AuthContext {
  userId: string
  igrejaId: string | null
  roles: string[]
}

async function validateAuth(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  authHeader: string | null,
  targetIgrejaId: string
): Promise<{ authorized: boolean; error?: string; context?: AuthContext }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Token não fornecido' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  // Validar token e obter claims
  const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token)
  
  if (claimsError || !claims?.claims) {
    console.error('[santander-api] getClaims failed:', claimsError)
    return { authorized: false, error: 'Token inválido' }
  }

  const userId = claims.claims.sub as string
  if (!userId) {
    return { authorized: false, error: 'User ID não encontrado no token' }
  }

  console.log('[santander-api] Validating user:', userId)

  // Buscar papéis do usuário
  const { data: userRoles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role, igreja_id')
    .eq('user_id', userId)

  if (rolesError) {
    console.error('[santander-api] Error fetching roles:', rolesError)
    return { authorized: false, error: 'Erro ao buscar papéis do usuário' }
  }

  if (!userRoles || userRoles.length === 0) {
    return { authorized: false, error: 'Usuário sem papéis atribuídos' }
  }

  console.log('[santander-api] User roles:', userRoles)

  // Verificar se tem papel autorizado
  // deno-lint-ignore no-explicit-any
  const hasAuthorizedRole = userRoles.some((ur: any) => {
    const roleStr = String(ur.role)
    
    // super_admin tem acesso a tudo
    if (roleStr === 'super_admin') return true
    
    // Verificar se tem papel autorizado E está vinculado ao igreja_id correto
    if (AUTHORIZED_ROLES.includes(roleStr)) {
      // Se o papel não tem igreja_id, não autoriza (exceto super_admin)
      if (!ur.igreja_id) return false
      // Verificar se o igreja_id corresponde
      return ur.igreja_id === targetIgrejaId
    }
    
    return false
  })

  if (!hasAuthorizedRole) {
    return { 
      authorized: false, 
      error: 'Usuário não tem permissão para esta operação' 
    }
  }

  return {
    authorized: true,
    context: {
      userId,
      igrejaId: targetIgrejaId,
      // deno-lint-ignore no-explicit-any
      roles: userRoles.map((ur: any) => String(ur.role))
    }
  }
}

// ==================== SANTANDER API CALLS ====================

interface SantanderCredentials {
  clientId: string
  clientSecret: string
  applicationKey: string
  httpClient: Deno.HttpClient | null
}

async function getSantanderToken(
  creds: SantanderCredentials
): Promise<{ token: string; expiresIn: number } | { error: string }> {
  console.log('[santander-api] Requesting OAuth2 token...')

  const tokenBody = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'client_credentials',
  }).toString()

  const tokenResponse = await fetch(SANTANDER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
    ...(creds.httpClient && { client: creds.httpClient }),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    console.error('[santander-api] Token request failed:', tokenResponse.status, errorText)
    return { error: `Falha na autenticação: ${tokenResponse.status}` }
  }

  const tokenData = await tokenResponse.json()

  if (!tokenData.access_token) {
    return { error: 'Token não retornado pela API' }
  }

  console.log('[santander-api] Token obtained successfully')
  return { 
    token: tokenData.access_token, 
    expiresIn: tokenData.expires_in 
  }
}

async function queryBalance(
  token: string,
  applicationKey: string,
  bancoId: string,
  agencia: string,
  contaFormatada: string,
  httpClient: Deno.HttpClient | null
): Promise<{ data: unknown } | { error: string; status: number }> {
  console.log('[santander-api] Querying balance...')

  const balanceUrl = `${SANTANDER_BASE_URL}/banks/${bancoId}/balances/${agencia}.${contaFormatada}`
  const balanceResponse = await fetch(balanceUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Application-Key': applicationKey,
    },
    ...(httpClient && { client: httpClient }),
  })

  if (balanceResponse.ok) {
    const balance = await balanceResponse.json()
    console.log('[santander-api] Balance query successful')
    return { data: balance }
  } else {
    const errorText = await balanceResponse.text()
    console.warn('[santander-api] Balance query failed:', balanceResponse.status)
    return { error: errorText, status: balanceResponse.status }
  }
}

async function queryStatement(
  token: string,
  applicationKey: string,
  bancoId: string,
  agencia: string,
  contaFormatada: string,
  dataInicio: string,
  dataFim: string,
  httpClient: Deno.HttpClient | null
): Promise<{ data: unknown[]; count: number } | { error: string; status: number }> {
  console.log('[santander-api] Querying statement...')

  const statementUrl = new URL(
    `${SANTANDER_BASE_URL}/banks/${bancoId}/statements/${agencia}.${contaFormatada}`,
  )

  statementUrl.searchParams.set('_offset', '1')
  statementUrl.searchParams.set('_limit', '500')
  statementUrl.searchParams.set('initialDate', dataInicio)
  statementUrl.searchParams.set('finalDate', dataFim)

  console.log(`[santander-api] Statement URL: ${statementUrl.toString()}`)

  const statementResponse = await fetch(statementUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Application-Key': applicationKey,
    },
    ...(httpClient && { client: httpClient }),
  })

  if (statementResponse.ok) {
    const statement = await statementResponse.json()
    console.log('[santander-api] Statement raw response:', JSON.stringify(statement))
    // Santander returns { _content: [...], _pageable: {...} } or similar structure
    const records = Array.isArray(statement) 
      ? statement 
      : (statement?._content || statement?.content || statement?.transactions || statement?.data || [])
    console.log('[santander-api] Statement query successful, got', records.length, 'records')
    return { data: records, count: records.length }
  } else {
    const errorText = await statementResponse.text()
    console.warn('[santander-api] Statement query failed:', statementResponse.status)
    return { error: errorText, status: statementResponse.status }
  }
}

// ==================== SYNC LOGIC ====================

interface SyncResult {
  total_recebido: number
  inseridos: number
  atualizados: number
  ignorados: number
  erros: string[]
}

async function syncExtrato(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  contaId: string,
  igrejaId: string,
  filialId: string | null,
  transacoes: unknown[]
): Promise<SyncResult> {
  const result: SyncResult = {
    total_recebido: transacoes.length,
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: []
  }

  for (const tx of transacoes) {
    try {
      const record = tx as Record<string, unknown>

      const pickStr = (...vals: unknown[]) => {
        for (const v of vals) {
          if (v === undefined || v === null) continue
          const s = String(v).trim()
          if (s) return s
        }
        return ''
      }

      const normalizeDate = (raw: string) => {
        // Santander costuma retornar DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
          const [dd, mm, yyyy] = raw.split('/')
          return `${yyyy}-${mm}-${dd}`
        }
        return raw
      }

      const sha256Hex = async (input: string) => {
        const bytes = new TextEncoder().encode(input)
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        return Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      }

      // Mapear campos do Santander para nosso modelo
      // Construir descrição completa incluindo historicComplement (dados do pagador/recebedor)
      const descricaoBase = pickStr(
        record.description,
        record.memo,
        record.transactionName
      )
      const complemento = pickStr(
        record.historicComplement,
        record.payerName,
        record.receiverName,
        record.counterPartyName,
        record.narrative
      )
      const descricao = complemento 
        ? `${descricaoBase} - ${complemento}`
        : descricaoBase

      const dataTransacaoRaw = pickStr(
        record.date,
        record.transactionDate,
        record.transaction_date
      )
      const dataTransacao = normalizeDate(dataTransacaoRaw)

      const valorRaw = Number(
        pickStr(record.amount, record.value, record.valor, 0).replace(',', '.')
      )

      const saldo = record.balance !== undefined ? Number(record.balance) : null
      const numeroDocumento = record.documentNumber ? String(record.documentNumber) : null

      // Inferir tipo: preferir campo explícito do Santander, fallback pelo sinal do valor
      const creditDebitType = pickStr(record.creditDebitType, record.credit_debit_type, record.type)
      let tipo: 'credito' | 'debito'
      
      if (creditDebitType) {
        // Santander usa CREDIT/DEBIT ou C/D
        const normalized = creditDebitType.toUpperCase()
        if (normalized === 'DEBIT' || normalized === 'D' || normalized === 'DEBITO') {
          tipo = 'debito'
        } else {
          tipo = 'credito'
        }
      } else {
        // Fallback pelo sinal do valor
        tipo = valorRaw >= 0 ? 'credito' : 'debito'
      }
      
      const valor = Math.abs(valorRaw)

      // ID externo: preferir ID do provedor; fallback determinístico (ADR-022)
      const providerId = pickStr(record.transactionId, record.fitId, record.id)
      const fallbackKey = `${dataTransacao}|${valorRaw}|${descricao}|${numeroDocumento ?? ''}|${pickStr(record.creditDebitType)}`
      const externalId = providerId || await sha256Hex(fallbackKey)

      if (!externalId || !dataTransacao) {
        result.erros.push(`Transação sem ID ou data: ${JSON.stringify(record).substring(0, 160)}`)
        continue
      }

      // Upsert com dedupe por external_id
      const { error: upsertError } = await supabaseAdmin
        .from('extratos_bancarios')
        .upsert(
          {
            conta_id: contaId,
            igreja_id: igrejaId,
            filial_id: filialId,
            external_id: externalId,
            data_transacao: dataTransacao,
            descricao,
            valor,
            tipo,
            saldo,
            numero_documento: numeroDocumento,
            origem: 'api_santander',
            reconciliado: false
          },
          {
            onConflict: 'conta_id,external_id',
            ignoreDuplicates: false
          }
        )

      if (upsertError) {
        // Se for erro de duplicata, conta como ignorado
        if (upsertError.code === '23505') {
          result.ignorados++
        } else {
          result.erros.push(`Erro ao inserir transação ${externalId}: ${upsertError.message}`)
        }
      } else {
        result.inseridos++
      }
    } catch (err) {
      result.erros.push(`Erro processando transação: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  let httpClient: Deno.HttpClient | null = null

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error('[santander-api] Missing Supabase env vars')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    if (!encryptionKey) {
      console.error('[santander-api] ENCRYPTION_KEY not configured')
      return jsonResponse({ error: 'Encryption not configured' }, 500)
    }

    // Parse payload
    const payload = await req.json()
    const { action, integracao_id, conta_id, data_inicio, data_fim } = payload

    if (!action || !['saldo', 'extrato', 'sync'].includes(action)) {
      return jsonResponse({ error: 'Ação inválida. Use: saldo, extrato ou sync' }, 400)
    }

    if (!integracao_id || !conta_id) {
      return jsonResponse({ error: 'Campos obrigatórios: integracao_id, conta_id' }, 400)
    }

    console.log(`[santander-api] Action: ${action}, Integração: ${integracao_id}, Conta: ${conta_id}`)

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // Fetch integration
    const { data: integracao, error: integError } = await supabaseAdmin
      .from('integracoes_financeiras')
      .select('*')
      .eq('id', integracao_id)
      .single()

    if (integError || !integracao) {
      console.error('[santander-api] Integration not found:', integError)
      return jsonResponse({ error: 'Integração não encontrada' }, 404)
    }

    if (integracao.provedor !== 'santander') {
      return jsonResponse({ error: 'Esta função é apenas para Santander' }, 400)
    }

    // Validate authorization
    const authResult = await validateAuth(supabaseAdmin, authHeader, integracao.igreja_id)
    if (!authResult.authorized) {
      console.warn('[santander-api] Authorization failed:', authResult.error)
      return jsonResponse({ error: authResult.error }, 403)
    }

    console.log('[santander-api] User authorized:', authResult.context?.userId)

    // Fetch conta details
    const { data: conta, error: contaError } = await supabaseAdmin
      .from('contas')
      .select('id, agencia, conta_numero, cnpj_banco, filial_id')
      .eq('id', conta_id)
      .single()

    if (contaError || !conta) {
      console.error('[santander-api] Conta not found:', contaError)
      return jsonResponse({ error: 'Conta não encontrada' }, 404)
    }

    if (!conta.agencia || !conta.conta_numero) {
      return jsonResponse({ error: 'Dados da conta incompletos (agência/número)' }, 400)
    }

    const bancoId = conta.cnpj_banco || '90400888000142'
    const agencia = conta.agencia
    const contaLimpa = conta.conta_numero.replace(/\D/g, '')
    const contaFormatada = contaLimpa.padStart(12, '0')

    console.log(`[santander-api] Conta formatada: ${contaLimpa} -> ${contaFormatada}`)

    // Fetch secrets
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from('integracoes_financeiras_secrets')
      .select('*')
      .eq('integracao_id', integracao_id)
      .single()

    if (secretsError || !secrets) {
      console.error('[santander-api] Secrets not found:', secretsError)
      return jsonResponse({ error: 'Credenciais não encontradas' }, 404)
    }

    // Decrypt credentials
    const derivedKey = deriveKey(encryptionKey)

    let clientId: string | null = null
    let clientSecret: string | null = null
    let applicationKey: string | null = null
    let pfxBlob: string | null = null
    let pfxPassword: string | null = null

    try {
      if (secrets.client_id) clientId = decryptData(secrets.client_id, derivedKey)
      if (secrets.client_secret) clientSecret = decryptData(secrets.client_secret, derivedKey)
      if (secrets.application_key) applicationKey = decryptData(secrets.application_key, derivedKey)
      if (secrets.pfx_blob) pfxBlob = decryptData(secrets.pfx_blob, derivedKey)
      if (secrets.pfx_password) pfxPassword = decryptData(secrets.pfx_password, derivedKey)
    } catch (error) {
      console.error('[santander-api] Decryption failed:', error)
      return jsonResponse({ error: `Falha na descriptografia: ${error instanceof Error ? error.message : String(error)}` }, 500)
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Client ID ou Secret não encontrado' }, 400)
    }

    if (!applicationKey) {
      return jsonResponse({ error: 'Application Key não configurada' }, 400)
    }

    // Create mTLS HttpClient
    if (pfxBlob && pfxPassword) {
      try {
        console.log('[santander-api] Converting PFX to PEM for mTLS...')
        const { cert, key } = pfxToPem(pfxBlob, pfxPassword)
        httpClient = Deno.createHttpClient({ cert, key })
        console.log('[santander-api] mTLS HttpClient created successfully')
      } catch (pfxError) {
        console.error('[santander-api] PFX conversion failed:', pfxError)
        return jsonResponse({
          error: 'Falha ao processar certificado',
          detail: pfxError instanceof Error ? pfxError.message : String(pfxError),
        }, 500)
      }
    } else {
      console.warn('[santander-api] No PFX certificate found - will attempt standard TLS only')
    }

    // Get OAuth2 token
    const tokenResult = await getSantanderToken({
      clientId,
      clientSecret,
      applicationKey,
      httpClient
    })

    if ('error' in tokenResult) {
      return jsonResponse({ 
        success: false, 
        tokenSuccess: false,
        error: tokenResult.error 
      }, 401)
    }

    const token = tokenResult.token

    // Date range defaults
    const today = new Date()
    const daysAgo = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000)
    const formatDate = (date: Date) => date.toISOString().split('T')[0]
    const dataInicioFinal = data_inicio || formatDate(daysAgo)
    const dataFimFinal = data_fim || formatDate(today)

    // Execute action
    if (action === 'saldo') {
      const balanceResult = await queryBalance(
        token, applicationKey, bancoId, agencia, contaFormatada, httpClient
      )

      if ('error' in balanceResult) {
        return jsonResponse({
          success: false,
          tokenSuccess: true,
          balanceError: balanceResult.error
        })
      }

      return jsonResponse({
        success: true,
        action: 'saldo',
        balance: balanceResult.data,
        conta: {
          id: conta_id,
          agencia,
          conta: contaLimpa
        }
      })
    }

    if (action === 'extrato') {
      const statementResult = await queryStatement(
        token, applicationKey, bancoId, agencia, contaFormatada,
        dataInicioFinal, dataFimFinal, httpClient
      )

      if ('error' in statementResult) {
        return jsonResponse({
          success: false,
          tokenSuccess: true,
          statementError: statementResult.error
        })
      }

      return jsonResponse({
        success: true,
        action: 'extrato',
        periodo: { inicio: dataInicioFinal, fim: dataFimFinal },
        transacoes: statementResult.data,
        total: statementResult.count,
        conta: {
          id: conta_id,
          agencia,
          conta: contaLimpa
        }
      })
    }

    if (action === 'sync') {
      // First get statement
      const statementResult = await queryStatement(
        token, applicationKey, bancoId, agencia, contaFormatada,
        dataInicioFinal, dataFimFinal, httpClient
      )

      if ('error' in statementResult) {
        return jsonResponse({
          success: false,
          tokenSuccess: true,
          statementError: statementResult.error
        })
      }

      // Then sync to database
      const syncResult = await syncExtrato(
        supabaseAdmin,
        conta_id,
        integracao.igreja_id,
        conta.filial_id,
        statementResult.data
      )

      // Call reconciliation RPC if any records were inserted
      let reconciliados = 0
      if (syncResult.inseridos > 0) {
        try {
          const { data: reconcData, error: reconcError } = await supabaseAdmin
            .rpc('reconciliar_transacoes', { p_conta_id: conta_id })

          if (reconcError) {
            console.warn('[santander-api] Reconciliation RPC failed:', reconcError)
          } else {
            reconciliados = Array.isArray(reconcData) ? reconcData.length : 0
            console.log('[santander-api] Reconciled', reconciliados, 'transactions')
          }
        } catch (err) {
          console.warn('[santander-api] Reconciliation error:', err)
        }
      }

      return jsonResponse({
        success: true,
        action: 'sync',
        periodo: { inicio: dataInicioFinal, fim: dataFimFinal },
        resultado: {
          ...syncResult,
          reconciliados
        },
        conta: {
          id: conta_id,
          agencia,
          conta: contaLimpa
        }
      })
    }

    return jsonResponse({ error: 'Ação não implementada' }, 400)

  } catch (error) {
    console.error('[santander-api] Unhandled error:', error)
    return jsonResponse({
      error: 'Erro interno do servidor',
      detail: error instanceof Error ? error.message : String(error),
    }, 500)
  } finally {
    if (httpClient) {
      httpClient.close()
    }
  }
})
