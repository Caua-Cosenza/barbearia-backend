import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { createApiResponse, createErrorResponse } from '../utils/validation'
import { professionalRepository } from '../repositories/professionalRepository'
import { serviceRepository } from '../repositories/serviceRepository'
import { appointmentRepository } from '../repositories/appointmentRepository'
import { prisma } from '../config/database'

const AvailableTimesSchema = z.object({
  professionalId: z.string().uuid('Invalid professional ID'),
  serviceId: z.string().uuid('Invalid service ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  // When multiple services are selected the frontend sends their combined duration
  // so slots are spaced by the actual total booking time, not just one service.
  totalDurationMinutes: z.number().int().positive().optional(),
})

// Brazil is permanently UTC-3 (no DST since 2019).
const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000

// Returns the current date string (YYYY-MM-DD) and total minutes since midnight
// both expressed in Brazil local time, regardless of where the server runs.
function getBrazilNow(): { todayStr: string; currentMinutes: number } {
  const brazilNow = new Date(Date.now() + BRAZIL_OFFSET_MS)
  const todayStr = [
    brazilNow.getUTCFullYear(),
    String(brazilNow.getUTCMonth() + 1).padStart(2, '0'),
    String(brazilNow.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const currentMinutes = brazilNow.getUTCHours() * 60 + brazilNow.getUTCMinutes()
  return { todayStr, currentMinutes }
}

// Convert "HH:MM" to total minutes since midnight.
function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function isSlotBlocked(
  slotStart: string,
  slotDuration: number,
  blocks: { startTime: string; endTime: string }[],
): boolean {
  const slotStartMin = parseTime(slotStart)
  const slotEndMin = slotStartMin + slotDuration
  return blocks.some((b) => slotStartMin < parseTime(b.endTime) && slotEndMin > parseTime(b.startTime))
}

export const availableTimesController = {
  async fetch(req: FastifyRequest, reply: FastifyReply) {
    const { professionalId, serviceId, date, totalDurationMinutes } =
      AvailableTimesSchema.parse(req.body)

    // Build day-of-week from date parts to avoid any timezone offset in the Date
    // constructor that would shift the day when running outside UTC.
    const [y, mo, d] = date.split('-').map(Number)
    const dayOfWeek = new Date(y, mo - 1, d).getDay() // local time, 0=Sun

    const [professional, service] = await Promise.all([
      professionalRepository.findById(professionalId),
      serviceRepository.findById(serviceId),
    ])

    if (!professional) {
      return reply
        .status(404)
        .send(createErrorResponse('Not Found', 'Professional not found'))
    }
    if (!service) {
      return reply
        .status(404)
        .send(createErrorResponse('Not Found', 'Service not found'))
    }

    const availability = professional.availability.find((a) => a.dayOfWeek === dayOfWeek)
    if (!availability) {
      return reply.send(createApiResponse({ slots: [] }))
    }

    // Use combined duration when multiple services are selected; otherwise use
    // the single service duration from the database. Cap at 50 min max.
    const rawDuration = totalDurationMinutes ?? service.durationMinutes
    const slotDuration = Math.min(rawDuration, 50)
    const startMin = parseTime(availability.startTime)
    const endMin = parseTime(availability.endTime)

    const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0)
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999)

    const [existing, blockedSlots] = await Promise.all([
      appointmentRepository.findByProfessionalAndDate(professionalId, dayStart, dayEnd),
      prisma.blockedSlot.findMany({ where: { professionalId, date } }),
    ])

    // Build sorted list of occupied time blocks.
    // For N:N appointments use the sum of AppointmentService.durationMinutes;
    // fall back to the legacy service FK duration for older records.
    const occupiedBlocks: { start: number; end: number }[] = existing
      .map((apt) => {
        // Convert stored UTC scheduledAt to Brazil local minutes since midnight.
        const brazilTime = new Date(apt.scheduledAt.getTime() + BRAZIL_OFFSET_MS)
        const aptStart = brazilTime.getUTCHours() * 60 + brazilTime.getUTCMinutes()

        const aptDuration =
          apt.services.length > 0
            ? apt.services.reduce((sum, s) => sum + s.durationMinutes, 0)
            : (apt.service?.durationMinutes ?? 30)

        return { start: aptStart, end: aptStart + aptDuration }
      })
      .sort((a, b) => a.start - b.start)

    // Walk through the occupied blocks to collect free gaps in the work window.
    const gaps: { start: number; end: number }[] = []
    let cursor = startMin

    for (const block of occupiedBlocks) {
      if (cursor < block.start) {
        gaps.push({ start: cursor, end: block.start })
      }
      cursor = Math.max(cursor, block.end)
    }
    if (cursor < endMin) {
      gaps.push({ start: cursor, end: endMin })
    }

    // Generate slots inside each gap, advancing by slotDuration each time.
    let freeSlots: string[] = []
    for (const gap of gaps) {
      let current = gap.start
      while (current + slotDuration <= gap.end) {
        const hh = String(Math.floor(current / 60)).padStart(2, '0')
        const mm = String(current % 60).padStart(2, '0')
        freeSlots.push(`${hh}:${mm}`)
        current += slotDuration
      }
    }

    // Remove slots that are less than 15 minutes away if today in Brazil time.
    const { todayStr, currentMinutes } = getBrazilNow()
    if (date === todayStr) {
      const cutoff = currentMinutes + 15
      freeSlots = freeSlots.filter((slot) => parseTime(slot) >= cutoff)
    }

    // Remove slots that overlap with admin-created blocked periods.
    freeSlots = freeSlots.filter((slot) => !isSlotBlocked(slot, slotDuration, blockedSlots))

    return reply.send(createApiResponse({ slots: freeSlots }))
  },
}
