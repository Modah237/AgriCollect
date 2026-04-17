import axios from 'axios';
import { logger } from '../lib/logger';

const FAPSHI_API_URL = 'https://api.fapshi.com';
const FAPSHI_USER_ID = process.env.FAPSHI_API_USER_ID;
const FAPSHI_API_KEY = process.env.FAPSHI_API_KEY;

export interface FapshiPayoutRequest {
  amount: number;
  phone: string;
  externalId: string;
}

export interface FapshiPayoutResponse {
  transId: string;
  status: 'CREATED' | 'SUCCESSFUL' | 'FAILED';
  message?: string;
}

/**
 * Service pour les paiements via Fapshi (Paiements mobiles au Cameroun)
 */

export async function sendPayout(phone: string, amount: number, externalId: string): Promise<FapshiPayoutResponse> {
  try {
    if (!FAPSHI_USER_ID || !FAPSHI_API_KEY) {
      throw new Error('Fapshi credentials missing');
    }

    const response = await axios.post(
      `${FAPSHI_API_URL}/direct-delivery`,
      { amount, phone, externalId },
      {
        headers: {
          'apiuser': FAPSHI_USER_ID,
          'apikey': FAPSHI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      transId: response.data.transId,
      status: response.data.status,
    };
  } catch (err: any) {
    logger.error({ err, phone, amount }, 'Fapshi payout failed');
    return {
      transId: '',
      status: 'FAILED',
      message: err.response?.data?.message || err.message,
    };
  }
}

export async function getPayoutStatus(transId: string): Promise<'CREATED' | 'SUCCESSFUL' | 'FAILED'> {
  try {
    const response = await axios.get(`${FAPSHI_API_URL}/payment-status/${transId}`, {
      headers: {
        'apiuser': FAPSHI_USER_ID,
        'apikey': FAPSHI_API_KEY,
      },
    });

    return response.data.status;
  } catch (err: any) {
    logger.error({ err, transId }, 'Fapshi status check failed');
    throw err;
  }
}

import crypto from 'crypto';

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!FAPSHI_API_KEY) return false;
  
  const hmac = crypto.createHmac('sha256', FAPSHI_API_KEY);
  const hash = hmac.update(body).digest('hex');
  
  return hash === signature;
}

export const fapshiService = {
  sendPayout,
  getPayoutStatus,
  verifyWebhookSignature,
};
