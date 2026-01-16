// supabase/functions/debug-certificate/index.ts
/**
 * Edge Function para extrair e exibir detalhes do certificado PFX
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.3.1'
import nacl from 'npm:tweetnacl@1.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

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

/**
 * Converte bytea do Supabase para string.
 */
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
        console.warn('[debug-certificate] Failed to decode hex bytea:', err)
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

/**
 * Descriptografa dados usando XSalsa20-Poly1305.
 */
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
      console.log('[debug-certificate] Data too short to be encrypted, returning as-is')
      return encryptedStr
    }
    
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)

    const decrypted = nacl.secretbox.open(ciphertext, nonce, key)
    if (!decrypted) {
      console.warn('[debug-certificate] Decryption failed, trying as plain text')
      return encryptedStr
    }

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.warn('[debug-certificate] Base64 decode failed, returning original:', error)
    return encryptedStr
  }
}

// ==================== PFX UTILITIES ====================

function pfxToPem(pfxData: string, password?: string): { cert: string; key: string } {
  try {
    console.log('[pfxToPem] Input type:', typeof pfxData)
    console.log('[pfxToPem] Input length:', pfxData.length)
    console.log('[pfxToPem] First 50 chars:', pfxData.substring(0, 50))
    
    let pfxDer: string

    // Caso venha como JSON { data: [ ...bytes ] }
    if (pfxData.trim().startsWith('{')) {
      console.log('[pfxToPem] Detected JSON format')
      try {
        const parsed = JSON.parse(pfxData)
        if (Array.isArray(parsed.data)) {
          console.log('[pfxToPem] JSON has data array with', parsed.data.length, 'bytes')
          const uint8 = new Uint8Array(parsed.data)
          let binary = ''
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i])
          }
          pfxDer = binary
          console.log('[pfxToPem] Converted to binary string, length:', pfxDer.length)
        } else {
          throw new Error('JSON does not contain data array')
        }
      } catch (err) {
        throw new Error(`Invalid JSON PFX: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (/^[A-Za-z0-9+/]*={0,2}$/.test(pfxData)) {
      // Base64 padrão
      console.log('[pfxToPem] Detected base64 format')
      pfxDer = forge.util.decode64(pfxData)
      console.log('[pfxToPem] Decoded base64, length:', pfxDer.length)
    } else {
      // Tenta converter UTF-8 para base64
      console.log('[pfxToPem] Trying UTF-8 to base64 conversion')
      try {
        pfxDer = forge.util.decode64(btoa(unescape(encodeURIComponent(pfxData))))
      } catch {
        console.log('[pfxToPem] Using pfxData directly')
        pfxDer = pfxData
      }
    }
    
    console.log('[pfxToPem] Attempting ASN.1 parsing...')
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    console.log('[pfxToPem] ASN.1 parsed successfully')
    
    console.log('[pfxToPem] Attempting PKCS#12 parsing...')
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { integracao_id } = await req.json()

    if (!integracao_id) {
      return jsonResponse({ error: 'integracao_id is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Missing Supabase credentials' }, 500)
    }

    if (!encryptionKey) {
      return jsonResponse({ error: 'Missing ENCRYPTION_KEY' }, 500)
    }

    const key = deriveKey(encryptionKey)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from('integracoes_financeiras_secrets')
      .select('*')
      .eq('integracao_id', integracao_id)
      .single()

    if (secretsError || !secrets) {
      return jsonResponse({ error: 'Secrets not found' }, 404)
    }

    console.log('[debug-certificate] Analyzing certificate...')

    const pfxBlobEncrypted = secrets.pfx_blob
    const pfxPasswordEncrypted = secrets.pfx_password

    if (!pfxBlobEncrypted) {
      return jsonResponse({ error: 'PFX blob not found' }, 400)
    }

    console.log('[debug-certificate] PFX blob encrypted type:', typeof pfxBlobEncrypted)
    console.log('[debug-certificate] PFX password exists:', !!pfxPasswordEncrypted)

    // Descriptografar os dados
    const pfxBlob = decryptData(pfxBlobEncrypted, key)
    const pfxPassword = pfxPasswordEncrypted ? decryptData(pfxPasswordEncrypted, key) : undefined

    console.log('[debug-certificate] Decrypted PFX blob length:', pfxBlob.length)
    console.log('[debug-certificate] Decrypted PFX preview:', pfxBlob.substring(0, 50))

    try {
      const { cert } = pfxToPem(pfxBlob, pfxPassword)

      // Parse certificate using forge
      const certObj = forge.pki.certificateFromPem(cert)

      // Extract information
      const subject = certObj.subject.attributes
      const issuer = certObj.issuer.attributes
      const validFrom = certObj.validity.notBefore
      const validTo = certObj.validity.notAfter

      const subjectObj: Record<string, string> = {}
      const issuerObj: Record<string, string> = {}

      subject.forEach((attr: any) => {
        subjectObj[attr.name || attr.shortName] = attr.value
      })

      issuer.forEach((attr: any) => {
        issuerObj[attr.name || attr.shortName] = attr.value
      })

      // Extract CNPJ from commonName or organizationName
      let cnpj = null
      const commonName = subjectObj.commonName || subjectObj.CN || ''
      const orgName = subjectObj.organizationName || subjectObj.O || ''
      
      // Try to find CNPJ pattern (XX.XXX.XXX/XXXX-XX or just numbers)
      const cnpjPattern = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/
      const cnpjMatch = commonName.match(cnpjPattern) || orgName.match(cnpjPattern)
      if (cnpjMatch) {
        cnpj = cnpjMatch[1]
      }

      return jsonResponse({
        success: true,
        certificate: {
          subject: subjectObj,
          issuer: issuerObj,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          isExpired: new Date() > validTo,
          daysUntilExpiry: Math.floor(
            (validTo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          ),
          serialNumber: certObj.serialNumber ? forge.util.bytesToHex(certObj.serialNumber) : 'N/A',
          thumbprint: forge.util.bytesToHex(
            forge.md.sha256.create().update(forge.pki.certificateToPem(certObj)).digest().getBytes()
          ),
          cnpj: cnpj,
        },
      })
    } catch (certError) {
      return jsonResponse(
        {
          error: 'Certificate analysis failed',
          detail: certError instanceof Error ? certError.message : String(certError),
        },
        500,
      )
    }
  } catch (error) {
    console.error('[debug-certificate] Error:', error)
    return jsonResponse(
      {
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
