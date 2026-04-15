import axios from 'axios'
import crypto from 'crypto'

const BASE_URL = process.env.CAMPAY_BASE_URL || 'https://demo.campay.net/api'
const APP_USERNAME = process.env.CAMPAY_APP_USERNAME || ''
const APP_PASSWORD = process.env.CAMPAY_APP_PASSWORD || ''
const WEBHOOK_SECRET = process.env.CAMPAY_WEBHOOK_SECRET || ''

interface CampayToken {
  token: string
  expires: number
}

let cachedToken: CampayToken | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token
  }

  const response = await axios.post(`${BASE_URL}/token/`, {
    username: APP_USERNAME,
    password: APP_PASSWORD,
  })

  cachedToken = {
    token: response.data.token,
    expires: Date.now() + 50 * 60 * 1000, // 50 minutes (tokens valables 1h)
  }

  return cachedToken.token
}

export interface CollectResult {
  reference: string
  ussd_code?: string
  operator?: string
}

/**
 * Initie un paiement MoMo vers un producteur
 * @param phone Numéro de téléphone au format international (237XXXXXXXXX)
 * @param amount Montant en XAF (entier)
 * @param externalRef Référence unique de notre côté (paymentLine.id)
 */
export async function collectPayment(
  phone: string,
  amount: number,
  externalRef: string
): Promise<CollectResult> {
  const token = await getToken()

  const response = await axios.post(
    `${BASE_URL}/collect/`,
    {
      amount: amount.toString(),
      currency: 'XAF',
      from: phone,
      description: `Paiement AgriCollect — réf. ${externalRef}`,
      external_reference: externalRef,
    },
    {
      headers: { Authorization: `Token ${token}` },
      timeout: 30000,
    }
  )

  return {
    reference: response.data.reference,
    ussd_code: response.data.ussd_code,
    operator: response.data.operator,
  }
}

export interface PaymentStatus {
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING'
  amount?: string
  operator?: string
}

export async function getPaymentStatus(reference: string): Promise<PaymentStatus> {
  const token = await getToken()

  const response = await axios.get(`${BASE_URL}/transaction/${reference}/`, {
    headers: { Authorization: `Token ${token}` },
    timeout: 10000,
  })

  return {
    status: response.data.status,
    amount: response.data.amount,
    operator: response.data.operator,
  }
}

/**
 * Vérifie la signature HMAC d'un webhook Campay
 * Campay envoie un header X-Campay-Signature = HMAC-SHA256(body, secret)
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true // En mode dev sans secret configuré

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  )
}
