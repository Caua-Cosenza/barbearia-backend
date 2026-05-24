export interface AppointmentResponseDto {
  id: string
  scheduledAt: string
  status: string
  notes?: string | null
  service: {
    id: string
    name: string
    durationMinutes: number
    // amount NOT included — shown only on invoice/confirmation
  }
  professional: {
    id: string
    name: string
  }
  createdAt: string
}

export interface ServiceSnapshot {
  serviceId: string
  name: string
  amountCents: number
  durationMinutes: number
}

export interface PublicAppointmentResponseDto {
  id: string
  cancelToken: string
  scheduledAt: string
  status: string
  notes?: string | null
  services: ServiceSnapshot[]
  totalAmountCents: number
  totalDurationMinutes: number
  professional: {
    id: string
    name: string
  }
}
