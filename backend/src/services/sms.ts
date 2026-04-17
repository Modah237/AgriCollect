import { logger } from '../lib/logger';

/**
 * Service pour l'envoi de SMS (Cameroun Context)
 * À connecter à une gateway locale (Orange, MTN, ou agrégateur local)
 */
export async function sendPaymentConfirmation(phone: string, amount: number, fullName: string) {
  const message = `AgriCollect: Bonjour ${fullName}, votre paiement de ${amount.toLocaleString()} XAF a été confirmé. Merci pour votre livraison.`;
  
  // Simulation d'envoi
  logger.info({ phone, message }, '[SMS-SERVICE] Confirmation de paiement envoyée');
  
  // TODO: Intégrer API SMS (ex: Campay, Fapshi SMS, ou Orange)
}

export async function sendPaymentFailure(phone: string, amount: number, fullName: string) {
  const message = `AgriCollect: Bonjour ${fullName}, le paiement de ${amount.toLocaleString()} XAF a échoué. Veuillez contacter votre collecteur.`;
  
  logger.warn({ phone, message }, '[SMS-SERVICE] Alerte d\'échec de paiement envoyée');
}

export const smsService = {
  sendPaymentConfirmation,
  sendPaymentFailure
};
