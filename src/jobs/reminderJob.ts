import cron from 'node-cron'
import { prisma } from '../config/database'
import { decrypt } from '../utils/encryption'
import { logger } from '../utils/logger'
import { whatsappService } from '../services/whatsappService'

export function startReminderJob() {
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running reminder job')

    const now = new Date()
    const windowStart = new Date(now.getTime() + 80 * 60 * 1000)  // +1h20
    const windowEnd = new Date(now.getTime() + 100 * 60 * 1000)   // +1h40

    try {
      const appointments = await prisma.appointment.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { gte: windowStart, lte: windowEnd },
          confirmationSent: false,
        },
        include: {
          services: { include: { service: true } },
        },
      })

      logger.info({ count: appointments.length }, 'Appointments to remind')

      for (const apt of appointments) {
        try {
          if (!apt.guestPhoneEncrypted || !apt.guestNameEncrypted) {
            logger.warn({ appointmentId: apt.id }, 'Skipping reminder — missing encrypted PII')
            continue
          }

          const guestPhone = decrypt(apt.guestPhoneEncrypted)
          const guestName = decrypt(apt.guestNameEncrypted)
          const services = apt.services.map((s) => ({ name: s.service.name }))

          await whatsappService.sendConfirmationReminder(guestPhone, {
            guestName,
            scheduledAt: apt.scheduledAt,
            services,
          })

          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              confirmationSent: true,
              confirmationSentAt: new Date(),
            },
          })

          logger.info({ appointmentId: apt.id }, 'Reminder sent')
        } catch (err) {
          logger.error({ err, appointmentId: apt.id }, 'Failed to send reminder')
        }
      }
    } catch (err) {
      logger.error({ err }, 'Reminder job failed')
    }
  })
}
