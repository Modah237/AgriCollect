declare module 'africastalking' {
  interface SendSMSOptions {
    to: string[]
    message: string
    from?: string
  }

  interface SMSResponse {
    SMSMessageData: {
      Message: string
      Recipients: Array<{
        statusCode: number
        number: string
        status: string
        cost: string
        messageId: string
      }>
    }
  }

  interface SMSService {
    send(options: SendSMSOptions): Promise<SMSResponse>
  }

  interface AfricasTalkingOptions {
    apiKey: string
    username: string
  }

  interface AfricasTalkingInstance {
    SMS: SMSService
  }

  function AfricasTalking(options: AfricasTalkingOptions): AfricasTalkingInstance
  export = AfricasTalking
}
