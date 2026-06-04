import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcrypt'
import { encrypt } from '../src/utils/encryption'

const prisma = new PrismaClient()

async function main() {
  // ── Services ─────────────────────────────────────────────────────────────
  await prisma.service.deleteMany()

  const serviceData = [
    { name: 'Corte Máquina e Tesoura', description: 'Corte masculino com máquina e tesoura', durationMinutes: 50, amountCents: 4500 },
    { name: 'Corte na Tesoura', description: 'Corte masculino exclusivamente na tesoura', durationMinutes: 50, amountCents: 4500 },
    { name: 'Corte Disfarçado', description: 'Corte com disfarce degradê', durationMinutes: 50, amountCents: 4000 },
    { name: 'Corte Simples (1 Pente)', description: 'Corte simples com um pente', durationMinutes: 20, amountCents: 2500 },
    { name: 'Barba Simples', description: 'Aparar e modelar barba', durationMinutes: 15, amountCents: 1500 },
    { name: 'Cavanhaque', description: 'Modelagem de cavanhaque', durationMinutes: 5, amountCents: 2000 },
    { name: 'Barba Desenhada', description: 'Barba com design personalizado', durationMinutes: 20, amountCents: 2500 },
    { name: 'Barba Grande', description: 'Tratamento completo para barba grande', durationMinutes: 20, amountCents: 3000 },
    { name: 'Pigmentação de Cabelo Curto', description: 'Pigmentação capilar para cabelo curto', durationMinutes: 10, amountCents: 2000 },
    { name: 'Pigmentação de Barba', description: 'Pigmentação para barba', durationMinutes: 25, amountCents: 2500 },
    { name: 'Sobrancelha', description: 'Design e aparagem de sobrancelha', durationMinutes: 3, amountCents: 700 },
    { name: 'Acabamento / Pé', description: 'Acabamento e alinhamento', durationMinutes: 10, amountCents: 1000 },
  ]

  for (const service of serviceData) {
    await prisma.service.create({ data: { ...service, isActive: true } })
  }

  // ── Professional: Jhonatan Correa ─────────────────────────────────────────
  const JHONATAN_ID = '00000000-0000-0000-0000-000000000010'

  await prisma.professional.upsert({
    where: { id: JHONATAN_ID },
    update: {
      nameEncrypted: encrypt('Jhonatan Correa'),
      bio: 'Barbeiro profissional com mais de 8 anos de experiência. Especialista em cortes modernos e clássicos. Atendendo desde 2019.',
      isWalkIn: false,
      isActive: true,
    },
    create: {
      id: JHONATAN_ID,
      nameEncrypted: encrypt('Jhonatan Correa'),
      bio: 'Barbeiro profissional com mais de 8 anos de experiência. Especialista em cortes modernos e clássicos. Atendendo desde 2019.',
      isWalkIn: false,
      isActive: true,
    },
  })

  // Availability: Mon–Thu 08:40–19:00. Fri+Sat = walk-in (order of arrival). Sun = closed.
  await prisma.professionalAvailability.deleteMany({ where: { professionalId: JHONATAN_ID } })
  await prisma.professionalAvailability.createMany({
    data: [
      { professionalId: JHONATAN_ID, dayOfWeek: 1, startTime: '08:40', endTime: '19:00' },
      { professionalId: JHONATAN_ID, dayOfWeek: 2, startTime: '08:40', endTime: '19:00' },
      { professionalId: JHONATAN_ID, dayOfWeek: 3, startTime: '08:40', endTime: '19:00' },
      { professionalId: JHONATAN_ID, dayOfWeek: 4, startTime: '08:40', endTime: '19:00' },
    ],
  })

  // ── Walk-in professional ──────────────────────────────────────────────────
  const Emerson_ID = '00000000-0000-0000-0000-000000000011'

  const walkIn = await prisma.professional.upsert({
    where: { id: Emerson_ID },
    update: {
      isWalkIn: true,
      nameEncrypted: encrypt('Emerson Figueiredo'),
      bio: 'Especialista em cortes degradê e navalhados',
    },
    create: {
      id: Emerson_ID,
      nameEncrypted: encrypt('Emerson Figueiredo'),
      bio: 'Especialista em cortes degradê e navalhados',
      isWalkIn: true,
      isActive: true,
    },
  })

  // ── Admin user ────────────────────────────────────────────────────────────
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@barbearia.com'
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456' // NOSONAR
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      nameEncrypted: encrypt('Admin'),
      phoneEncrypted: encrypt('00000000000'),
      role: Role.ADMIN,
    },
  })

  console.log('Seeded:', {
    services: serviceData.length,
    professional: JHONATAN_ID,
    walkIn: walkIn.id,
    admin: admin.email,
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
