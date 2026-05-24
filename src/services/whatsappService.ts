import { logger } from '../utils/logger'
import { env } from '../config/env'

interface WelcomeData {
  guestName: string
  scheduledAt: Date
  services: { name: string }[]
  totalAmountCents: number
  cancelToken: string
}

interface ReminderData {
  guestName: string
  scheduledAt: Date
  services: { name: string }[]
}

interface BarberNotificationData {
  guestName: string
  guestPhone: string
  scheduledAt: Date
  services: { name: string }[]
  totalAmountCents: number
}

interface CancellationData {
  guestName: string
  scheduledAt: Date
  services: { name: string }[]
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const TZ = 'America/Sao_Paulo'

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(date)
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function formatServices(services: { name: string }[]): string {
  return services.map((s) => s.name).join(' + ')
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
}

// ── Base sender ───────────────────────────────────────────────────────────────

async function sendMessage(phone: string, message: string): Promise<void> {
  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionApiKey = process.env.EVOLUTION_API_KEY
  const evolutionInstance = process.env.EVOLUTION_INSTANCE_NAME

  if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
    logger.warn('Evolution API não configurada — WhatsApp ignorado')
    return
  }

  const digits = phone.replace(/\D/g, '')
  const number = digits.startsWith('55') ? digits : `55${digits}`

  try {
    await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey,
      },
      body: JSON.stringify({ number, text: message }),
    })
  } catch (error) {
    logger.error({ error, phone }, 'Falha ao enviar WhatsApp — continuando')
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const whatsappService = {
  async sendWelcomeMessage(phone: string, data: WelcomeData): Promise<void> {
    const cancelUrl = `${env.FRONTEND_URL ?? ''}/cancelar/${data.cancelToken}`

    const message = [
      `Olá, ${data.guestName}! 🎉`,
      '',
      'Seu agendamento foi confirmado!',
      '',
      `📅 *Data:* ${formatDate(data.scheduledAt)}`,
      `🕐 *Horário:* ${formatTime(data.scheduledAt)}`,
      `✂️ *Serviços:* ${formatServices(data.services)}`,
      `💰 *Total:* R$ ${formatAmount(data.totalAmountCents)}`,
      '',
      '🔗 Para cancelar seu agendamento:',
      cancelUrl,
      '',
      '_O cancelamento é permitido até 1 hora antes do horário._',
      '',
      'Até logo! 💈',
    ].join('\n')

    await sendMessage(phone, message)
  },

  async sendConfirmationReminder(phone: string, data: ReminderData): Promise<void> {
    const deadline = new Date(data.scheduledAt.getTime() - 60 * 60 * 1000)

    const message = [
      `Olá, ${data.guestName}! ⏰`,
      '',
      'Lembrete do seu horário de hoje!',
      '',
      `🕐 *Às* ${formatTime(data.scheduledAt)}`,
      `✂️ ${formatServices(data.services)}`,
      '',
      'Você confirma sua presença?',
      '',
      '👉 Responda *SIM* para confirmar',
      '👉 Responda *NÃO* para cancelar',
      '',
      `⚠️ *Prazo para resposta:* ${formatTime(deadline)}`,
    ].join('\n')

    await sendMessage(phone, message)
  },

  async sendBarberNewAppointment(phone: string, data: BarberNotificationData): Promise<void> {
    const message = [
      '🔔 *Novo agendamento!*',
      '',
      `👤 *Cliente:* ${data.guestName}`,
      `📱 *WhatsApp:* ${formatPhone(data.guestPhone)}`,
      `📅 *Data:* ${formatDate(data.scheduledAt)}`,
      `🕐 *Horário:* ${formatTime(data.scheduledAt)}`,
      `✂️ *Serviços:* ${formatServices(data.services)}`,
      `💰 *Total:* R$ ${formatAmount(data.totalAmountCents)}`,
    ].join('\n')

    await sendMessage(phone, message)
  },

  async sendBarberCancellation(phone: string, data: CancellationData): Promise<void> {
    const message = [
      '❌ *Agendamento cancelado*',
      '',
      `👤 *Cliente:* ${data.guestName}`,
      `📅 *Data:* ${formatDate(data.scheduledAt)}`,
      `🕐 *Horário:* ${formatTime(data.scheduledAt)}`,
      `✂️ *Serviços:* ${formatServices(data.services)}`,
      '',
      '_O horário ficou disponível._',
    ].join('\n')

    await sendMessage(phone, message)
  },
}
