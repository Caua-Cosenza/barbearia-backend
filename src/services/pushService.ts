import webPush from 'web-push'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { logger } from '../utils/logger'

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:admin@barbearia.com',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
}

interface PushPayload {
  title: string
  body: string
  icon?: string
}

async function sendPushNotification(
  subscription: webPush.PushSubscription,
  payload: PushPayload,
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    logger.warn('VAPID keys não configuradas — push ignorado')
    return
  }
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload))
  } catch (error) {
    logger.error({ error }, 'Falha ao enviar push notification')
  }
}

// Fetches all stored subscriptions and sends push to each. Fire-and-forget safe.
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return
  try {
    const subscriptions = await prisma.pushSubscription.findMany()
    for (const sub of subscriptions) {
      void sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    }
  } catch (error) {
    logger.error({ error }, 'Erro ao buscar subscriptions para push')
  }
}
