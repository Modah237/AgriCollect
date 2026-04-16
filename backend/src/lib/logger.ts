import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && !process.env.VERCEL
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production : JSON structuré
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
})
