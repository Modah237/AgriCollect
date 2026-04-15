import AfricasTalking from 'africastalking'

// Initialisation paresseuse pour éviter les erreurs de validation si l'API key est absente
let smsClient: any = null

function getSMSClient() {
  if (smsClient) return smsClient

  const apiKey = process.env.AFRICASTALKING_API_KEY
  const username = process.env.AFRICASTALKING_USERNAME || 'sandbox'

  if (!apiKey) {
    console.warn('[SMS Service] AFRICASTALKING_API_KEY manquant. Les SMS seront uniquement affichés dans la console.')
    smsClient = {
      send: async (params: any) => {
        console.log('--- ENVOI SMS (MOCK) ---')
        console.log(`À: ${params.to}`)
        console.log(`Message: ${params.message}`)
        console.log('------------------------')
        return { status: 'success', message: 'Mock sent' }
      }
    }
  } else {
    const at = AfricasTalking({ apiKey, username })
    smsClient = at.SMS
  }

  return smsClient
}

/**
 * Envoie un SMS de confirmation de paiement au producteur
 */
export async function sendPaymentConfirmation(
  phone: string,
  amount: number,
  producerName: string
): Promise<void> {
  const formatted = amount.toLocaleString('fr-FR')
  const message = `AgriCollect: Paiement de ${formatted} XAF reçu pour ${producerName}. Merci et bonne continuation!`

  const normalizedPhone = phone.startsWith('+') ? phone : `+237${phone.replace(/^237/, '')}`
  const client = getSMSClient()

  await client.send({
    to: [normalizedPhone],
    message,
    from: process.env.AFRICASTALKING_SENDER_ID || 'AgriCollect',
  })
}

/**
 * Envoie un SMS d'échec de paiement au producteur
 */
export async function sendPaymentFailure(
  phone: string,
  amount: number,
  producerName: string
): Promise<void> {
  const formatted = amount.toLocaleString('fr-FR')
  const message = `AgriCollect: Echec du paiement de ${formatted} XAF pour ${producerName}. Contactez votre gestionnaire.`

  const normalizedPhone = phone.startsWith('+') ? phone : `+237${phone.replace(/^237/, '')}`
  const client = getSMSClient()

  await client.send({
    to: [normalizedPhone],
    message,
    from: process.env.AFRICASTALKING_SENDER_ID || 'AgriCollect',
  })
}
