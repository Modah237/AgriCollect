import axios from 'axios'
import { logger } from '../lib/logger'

const FAPSHI_API_URL = 'https://live.fapshi.com/payout' // Fapshi direct pay endpoint
// Usually the endpoint requires auth via headers. According to usual Fapshi docs:
// headers: { 'apiuser': 'your-api-user-id', 'apikey': 'your-api-key' }

const API_USER = process.env.FAPSHI_API_USER_ID ?? ''
const API_KEY = process.env.FAPSHI_API_KEY ?? ''

export interface FapshiPayoutResponse {
  statusCode: number
  message: string
  transId?: string
  status?: string
}

/**
 * Initiates a MoMo Payout to a producer
 * @param phone Phone number without country code or with depending on Fapshi formatting
 * @param amount Amount in XAF
 * @param externalId Our internal transaction ID (PaymentLine ID)
 */
export async function sendPayout(phone: string, amount: number, externalId: string): Promise<FapshiPayoutResponse> {
  if (!API_USER || !API_KEY) {
    throw new Error('Fapshi API credentials not configured')
  }

  try {
    const payload = {
      amount,
      phone,
      externalId,
    }

    const response = await axios.post(`${FAPSHI_API_URL}`, payload, {
      headers: {
        apiuser: API_USER,
        apikey: API_KEY,
      },
    })

    return response.data
  } catch (error: any) {
    logger.error({ err: error.response?.data || error.message }, 'Erreur Fapshi sendPayout')
    if (error.response?.data) {
      return error.response.data as FapshiPayoutResponse
    }
    throw new Error(`Fapshi payout failed: ${error.message}`)
  }
}

/**
 * Checks the status of a specific payout transaction
 * @param transId Fapshi transaction ID
 */
export async function getPayoutStatus(transId: string): Promise<string> {
  if (!API_USER || !API_KEY) {
    throw new Error('Fapshi API credentials not configured')
  }

  try {
    const response = await axios.get(`${FAPSHI_API_URL}/${transId}`, {
      headers: {
        apiuser: API_USER,
        apikey: API_KEY,
      },
    })

    // Fapshi typically returns status in string format: "SUCCESSFUL", "FAILED", "CREATED"
    return response.data.status || 'UNKNOWN'
  } catch (error: any) {
    logger.error({ err: error.response?.data || error.message }, `Erreur Fapshi checkStatus pour ${transId}`)
    throw new Error('Impossible de vérifier le statut Fapshi')
  }
}

/**
 * Verify Fapshi webhook signature
 * Fapshi's webhook validation depends on their specific header. For now, we skip or use a simple check.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  // TODO: Implement Fapshi specific webhook signature validation
  logger.info("Fapshi webhook received without strict signature verification")
  return true
}
