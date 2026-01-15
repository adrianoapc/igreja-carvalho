// supabase/functions/debug-certificate/index.ts
/**
 * Edge Function para extrair e exibir detalhes do certificado PFX
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import forge from 'npm:node-forge@1.3.1'

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

function pfxToPem(pfxData: string, password?: string): { cert: string; key: string } {
  try {
    let pfxDer: string
    
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(pfxData)) {
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

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Missing Supabase credentials' }, 500)
    }

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

    const pfxBlob = secrets.pfx_blob
    const pfxPassword = secrets.pfx_password

    if (!pfxBlob) {
      return jsonResponse({ error: 'PFX blob not found' }, 400)
    }

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
