import { prisma } from '../config/database'
import { decrypt } from '../utils/encryption'

// AppointmentStatus includes NO_SHOW after migration add_no_show_status.
// If TypeScript shows an error here, stop the backend and run `npx prisma generate`.
type AppointmentStatusAll =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'

export interface AdminAppointmentRow {
  id: string
  scheduledAt: string
  status: AppointmentStatusAll
  customerName: string
  customerPhone: string
  customerEmail: string | null
  service: {
    id: string
    name: string
    durationMinutes: number
  }
  services: {
    name: string
    durationMinutes: number
  }[]
  professional: {
    id: string
    name: string
  }
}

export interface AdminStats {
  todayCount: number
  weekCount: number
  monthCount: number
  noShowCount: number
}

// ---- Brazil timezone helpers ----
// Brazil is permanently UTC-3 (no DST since 2019).
// We never use local-time setHours/setDate because the server timezone may differ.

const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000 // 3h in ms (UTC-3)

// Returns { start, end } as UTC Date objects bounding a full calendar day in Brazil time.
// E.g. "2026-05-23" → [2026-05-23T03:00:00Z, 2026-05-24T02:59:59.999Z]
function brazilDayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00-03:00`),
    end:   new Date(`${dateStr}T23:59:59.999-03:00`),
  }
}

// Returns today's date string (YYYY-MM-DD) in Brazil local time.
function brazilTodayStr(): string {
  const brazilNow = new Date(Date.now() - BRAZIL_OFFSET_MS)
  return brazilNow.toISOString().split('T')[0]
}

// ---- PII decryption ----
// Handles both guest bookings (guestNameEncrypted set) and
// authenticated bookings (user.nameEncrypted set via User relation).

function decryptAppointment(a: {
  id: string
  scheduledAt: Date
  status: string
  guestNameEncrypted: string | null
  guestPhoneEncrypted: string | null
  guestEmailEncrypted: string | null
  user: { nameEncrypted: string; phoneEncrypted: string } | null
  service: { id: string; name: string; durationMinutes: number }
  services: { service: { name: string; durationMinutes: number } }[]
  professional: { id: string; nameEncrypted: string }
}): AdminAppointmentRow {
  const customerName = a.guestNameEncrypted
    ? decrypt(a.guestNameEncrypted)
    : a.user
    ? decrypt(a.user.nameEncrypted)
    : 'Desconhecido'

  const customerPhone = a.guestPhoneEncrypted
    ? decrypt(a.guestPhoneEncrypted)
    : a.user
    ? decrypt(a.user.phoneEncrypted)
    : 'Desconhecido'

  const customerEmail = a.guestEmailEncrypted ? decrypt(a.guestEmailEncrypted) : null

  return {
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    status: a.status as AppointmentStatusAll,
    customerName,
    customerPhone,
    customerEmail,
    service: {
      id: a.service.id,
      name: a.service.name,
      durationMinutes: a.service.durationMinutes,
    },
    services: a.services.map((as) => ({
      name: as.service.name,
      durationMinutes: as.service.durationMinutes,
    })),
    professional: {
      id: a.professional.id,
      name: decrypt(a.professional.nameEncrypted),
    },
  }
}

// ---- Service ----

export const adminService = {
  async getAppointmentsByDate(dateStr: string): Promise<AdminAppointmentRow[]> {
    const { start, end } = brazilDayBounds(dateStr)
    if (isNaN(start.getTime())) {
      throw Object.assign(new Error('Formato de data inválido. Use YYYY-MM-DD'), { statusCode: 400 })
    }

    const rows = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        service: { select: { id: true, name: true, durationMinutes: true } },
        services: { include: { service: { select: { name: true, durationMinutes: true } } } },
        professional: { select: { id: true, nameEncrypted: true } },
        user: { select: { nameEncrypted: true, phoneEncrypted: true } },
      },
    })

    return rows.map(decryptAppointment)
  },

  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatusAll,
  ): Promise<{ id: string; status: AppointmentStatusAll }> {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment) {
      throw Object.assign(new Error('Agendamento não encontrado'), { statusCode: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.appointment.update({ where: { id }, data: { status: status as any } })

    return { id: updated.id, status: updated.status as AppointmentStatusAll }
  },

  async getStats(): Promise<AdminStats> {
    const todayStr = brazilTodayStr()
    const { start: todayStart, end: todayEnd } = brazilDayBounds(todayStr)

    // Week: Tue–Sat. Calculate how many days back to reach the most recent Tuesday.
    // 0=Sun→5, 1=Mon→6, 2=Tue→0, 3=Wed→1, 4=Thu→2, 5=Fri→3, 6=Sat→4
    const brazilNow = new Date(Date.now() - BRAZIL_OFFSET_MS)
    const currentDay = brazilNow.getUTCDay()
    const daysBackToTuesday = ((currentDay - 2) + 7) % 7

    const weekStartDate = new Date(brazilNow)
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysBackToTuesday)
    const weekStartStr = weekStartDate.toISOString().split('T')[0]
    const { start: weekStart } = brazilDayBounds(weekStartStr)

    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 4) // Tue + 4 = Sat
    const weekEndStr = weekEndDate.toISOString().split('T')[0]
    const { end: weekEnd } = brazilDayBounds(weekEndStr)

    // Month: first to last day of the current Brazil month
    const [year, month] = todayStr.split('-')
    const monthStart = new Date(`${year}-${month}-01T00:00:00-03:00`)
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const monthEndStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    const { end: monthEnd } = brazilDayBounds(monthEndStr)

    const activeStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED']

    const [todayCount, weekCount, monthCount, noShowCount] = await Promise.all([
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: todayStart, lte: todayEnd },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: { in: activeStatuses as any },
        },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: weekStart, lte: weekEnd },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: { in: activeStatuses as any },
        },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: monthStart, lte: monthEnd },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: { in: activeStatuses as any },
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.appointment.count({ where: { status: 'NO_SHOW' as any } }),
    ])

    return { todayCount, weekCount, monthCount, noShowCount }
  },
}
