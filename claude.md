# 📘 CLAUDE.md - Guia Completo do Projeto

**⚠️ IMPORTANTE: Este arquivo NÃO deve ser commitado no Git (.gitignore)**

---

## 🎯 VISÃO GERAL DO PROJETO

**Projeto:** Sistema de Agendamento para Barbearia  
**Cliente:** Barbeiro (acesso a dashboard de agendamentos)  
**Stack:** React 18 + Fastify + PostgreSQL + Redis + Cloudflare  
**Objetivo:** Sistema fluido, seguro, sem login (apenas nome/telefone)

---

## 🔐 SEGURANÇA - 9 VULNERABILIDADES A PROTEGER

### 1️⃣ AMOUNT (Preço)

**PROBLEMA:**
- User abre F12 (DevTools)
- Vê: `"amount": 50.00`
- Muda para: `"amount": 5.00`
- Envia requisição modificada
- Backend aceita? ROUBO!

**PROTEÇÃO:**
NUNCA enviar amount do frontend
├─ Frontend: NÃO incluir "amount" em nenhuma requisição
├─ Backend: Buscar do banco ANTES de processar
├─ Validação: Se amount vem no request → 400 Bad Request
└─ Armazenamento: Salvar amount do banco (não do cliente)

**Implementação:**
```javascript
// ❌ NUNCA fazer:
fetch('/api/appointments', {
  body: JSON.stringify({
    professionalId: 1,
    serviceId: 2,
    amount: 50.00  // ← NUNCA!
  })
});

// ✅ SEMPRE fazer:
fetch('/api/appointments', {
  body: JSON.stringify({
    professionalId: 1,
    serviceId: 2
    // amount NÃO VEM AQUI!
  })
});

// Backend:
const service = await db.services.findUnique({
  where: { id: serviceId }
});
const amount = service.price; // Do banco!
```

**Checklist:**
- [ ] Frontend: NÃO envia amount
- [ ] Backend: Busca amount do banco
- [ ] Middleware: Rejeita se amount vem em request
- [ ] Tests: Tenta enviar amount modificado → 400 error

---

### 2️⃣ IDs SEQUENCIAIS (Enumeration)

**PROBLEMA:**
GET /api/professionals/1 ✅
GET /api/professionals/2 ✅
GET /api/professionals/999 ✅
GET /api/professionals/1000 ❌ Not found
Atacker descobre: existem 999 profissionais!
Pode enumerar TODOS os dados.

**PROTEÇÃO:**
SEMPRE usar UUIDs (nunca sequential IDs)
├─ UUID = impossível adivinhar
├─ UUID = 550e8400-e29b-41d4-a716-446655440000
└─ Atacker tenta: apenas consegue lucky guess

**Implementação Prisma:**
```prisma
model Professional {
  id String @id @default(cuid()) // ← UUID automático
  name String
  email String @unique
}

model Service {
  id String @id @default(cuid()) // ← UUID automático
  name String
  price Decimal @db.Decimal(10, 2)
}

model Appointment {
  id String @id @default(cuid()) // ← UUID automático
  professionalId String
  serviceId String
  amount Decimal @db.Decimal(10, 2)
}
```

**Checklist:**
- [ ] Todos os models usam `@default(cuid())`
- [ ] NUNCA usar `@default(autoincrement())`
- [ ] IDs nas respostas são sempre UUIDs

---

### 3️⃣ JWT TOKENS EXPOSTOS

**PROBLEMA:**
No F12 (Network → Headers):
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Atacker:

Copia o token
Decodifica (base64):
{ "id": 1, "email": "admin@barbeiro.com", "isAdmin": true }
Usa token em outro lugar
Descobre que é admin!


**PROTEÇÃO:**
HttpOnly Cookies (JavaScript NÃO acessa)
├─ Token em Cookie com httpOnly=true
├─ JavaScript tenta: document.cookie
├─ Mas httpOnly bloqueia acesso programático
├─ Cookie enviado automaticamente em requisições
└─ XSS não consegue roubar (diferente de localStorage)

**Implementação:**
```javascript
// Backend (Fastify):
await reply.cookie('accessToken', token, {
  httpOnly: true,        // JavaScript não acessa
  secure: true,          // HTTPS only
  sameSite: 'Strict',    // CSRF protection
  maxAge: 15 * 60 * 1000 // 15 minutos
});

reply.setCookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
});

// Frontend (React):
// ❌ NUNCA fazer:
localStorage.setItem('token', token);

// ✅ SEMPRE fazer:
fetch('/api/appointments', {
  credentials: 'include' // Envia cookie automaticamente
  // NÃO incluir Authorization header!
});
```

**Checklist:**
- [ ] Token em HttpOnly Cookie (não localStorage)
- [ ] Cookies com secure=true e sameSite=Strict
- [ ] Frontend usa credentials: 'include'
- [ ] NENHUM token em localStorage

---

### 4️⃣ USER IDs / ADMIN FLAGS

**PROBLEMA:**
GET /api/auth/me
Response:
{
"id": 1,
"email": "admin@barbeiro.com",
"role": "ADMIN",           ← CRÍTICO!
"permissions": [...]
}
Atacker descobre:

Email do admin
Que é admin
Quais permissões existem


**PROTEÇÃO:**
NÃO retornar admin flags/permissions em responses públicas
├─ Cliente vê: apenas seu próprio email
├─ Admin flags: APENAS no backend
├─ Verificação: sempre buscar role do banco
└─ Frontend: NUNCA sabe se é admin

**Implementação:**
```javascript
// ❌ NUNCA:
res.json({
  id: 1,
  email: "admin@barbeiro.com",
  role: "ADMIN",
  permissions: ["edit", "delete"]
});

// ✅ SEMPRE:
res.json({
  id: "uuid-xxx",
  email: "seu-email@example.com"
  // Sem role, sem permissions!
});

// Verificar permissões no backend:
const isAdmin = async (req) => {
  const user = await db.users.findUnique({
    where: { id: req.user.id }
  });
  return user.role === 'ADMIN';
};

// Se não for admin:
if (!isAdmin(req)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**Checklist:**
- [ ] Responses NÃO incluem role/permissions
- [ ] Verificação de permissões apenas no backend
- [ ] IDs são UUIDs (não sequential)
- [ ] Frontend nunca tenta acessar endpoints protegidos

---

### 5️⃣ DADOS PESSOAIS EXPOSTOS (Phone/Email)

**PROBLEMA:**
GET /api/appointments
Response: [
{ phone: "21998217863", email: "joao@example.com", dateTime: "..." },
{ phone: "21987654321", email: "maria@example.com", dateTime: "..." },
...
]
Atacker vê:

TODOS os telefones
TODOS os emails
Pode fazer phishing/spam


**PROTEÇÃO:**
Dados pessoais encriptados + acesso restrito
├─ No banco: encriptado (AES-256)
├─ No response: apenas para quem agendou
├─ Sem exposição de lista completa
└─ Admin vê (com MFA)

**Implementação:**
```javascript
// Encriptação no banco:
model Appointment {
  phone String // Armazenar: "aes-256-encrypted-value"
  email String // Armazenar: "aes-256-encrypted-value"
}

// Buscar dados:
const appointment = await db.appointments.create({
  phone: encryptData(phone),      // Criptografa
  email: encryptData(email),
  ...
});

// Resposta ao cliente:
GET /api/appointments/uuid-abc
Response: {
  id: "uuid-abc",
  dateTime: "2026-05-06T10:00:00",
  status: "confirmed"
  // ❌ NÃO incluir: phone, email criptografados
}

// Resposta ao admin (com MFA):
GET /api/admin/appointments/uuid-abc
Response: {
  id: "uuid-abc",
  phone: "21998217863",    // Descriptografado
  email: "joao@example.com",
  dateTime: "2026-05-06T10:00:00",
  status: "confirmed"
}
```

**Checklist:**
- [ ] Phone/email encriptado no banco
- [ ] Cliente só vê seus próprios dados
- [ ] Admin vê tudo (com MFA)
- [ ] Lista de agendamentos não expõe dados

---

### 6️⃣ ENDPOINTS EXPOSTOS

**PROBLEMA:**
No F12 (Network tab):
POST /api/appointments
GET /api/professionals
PUT /api/admin/settings       ← Descobriu endpoint de admin!
DELETE /api/admin/users/:id   ← Descobriu que pode deletar!

**PROTEÇÃO:**
Endpoints protegidos requerem autenticação
├─ Públicos: GET /api/professionals (ok expor)
├─ Protegidos: POST /api/appointments (requer token)
├─ Admin: PUT /api/admin/* (requer admin + MFA)
└─ Não descobrir endpoints = menos alvos

**Implementação:**
```javascript
// Rotas públicas:
app.get('/api/professionals', publicController.list);
app.get('/api/services', publicController.list);

// Rotas autenticadas:
app.post('/api/appointments',
  authMiddleware,      // Requer JWT
  bookingLimiter,      // Rate limit
  appointmentController.create
);

// Rotas admin:
app.put('/api/admin/settings',
  authMiddleware,      // JWT
  adminMiddleware,     // ADMIN role
  mfaMiddleware,       // MFA ativo
  settingsController.update
);

// Se acessar sem permissão:
DELETE /api/admin/users/1
Response: 401 Unauthorized (sem token)
       ou 403 Forbidden (sem admin role)
       ou 403 (admin, mas sem MFA)
```

**Checklist:**
- [ ] Rotas públicas documentadas
- [ ] Rotas protegidas requerem middleware
- [ ] Admin rotas requerem admin + MFA
- [ ] Mensagens genéricas (não diz qual permissão falta)

---

### 7️⃣ TIMESTAMPS METADATA

**PROBLEMA:**
GET /api/appointments/1
{
"createdAt": "2026-05-05T18:00:00Z",  ← Quando criou
"updatedAt": "2026-05-05T18:05:00Z"   ← Alteração
}
Atacker analisa:

Horários de criação (descobre padrão de uso)
Frequência de atualizações (descobre admin)
Data de agendamento (descobre agenda)


**PROTEÇÃO:**
Remover timestamps desnecessários de responses públicas
├─ Cliente: SEM createdAt/updatedAt
├─ Admin: COM timestamps (para auditoria)
└─ Apenas dados necessários

**Implementação:**
```javascript
// ❌ NUNCA em resposta pública:
res.json({
  id: "uuid",
  dateTime: "2026-05-06T10:00:00",
  createdAt: "2026-05-05T18:00:00",  // ← NÃO!
  updatedAt: "2026-05-05T18:05:00"   // ← NÃO!
});

// ✅ SEMPRE em resposta pública:
res.json({
  id: "uuid",
  dateTime: "2026-05-06T10:00:00",
  status: "confirmed"
  // Sem createdAt, sem updatedAt
});

// ✅ COM timestamps para admin:
if (isAdmin(req)) {
  response.createdAt = appointment.createdAt;
  response.updatedAt = appointment.updatedAt;
}
```

**Checklist:**
- [ ] Respostas públicas: SEM timestamps
- [ ] Respostas admin: COM timestamps
- [ ] DTO de response remove campos desnecessários

---

### 8️⃣ ERROR MESSAGES DETALHADOS

**PROBLEMA:**
POST /api/appointments (erro)
Response:
{
"error": "Cannot read property 'price' of undefined at /app/src/services/appointmentService.ts:45:23",
"stack": "Error: SELECT * FROM services WHERE id = 999",
"database": "PostgreSQL 15.2"
}
Atacker descobre:

Stack trace completo (estrutura do código)
Banco de dados (PostgreSQL)
Versão (vulnerabilidades conhecidas)


**PROTEÇÃO:**
Erros genéricos para cliente, stack trace em logs
├─ Cliente vê: "Something went wrong"
├─ Logs internos: stack trace completo
├─ Ninguém sabe exatamente o que falhou
└─ Impossível explorar

**Implementação:**
```javascript
try {
  await appointmentService.create(data);
} catch (error) {
  // ❌ NUNCA retornar para cliente:
  // res.json({ error: error.message, stack: error.stack });
  
  // ✅ SEMPRE fazer:
  
  // 1. Logar tudo internamente:
  logger.error('Appointment creation failed', {
    error: error.message,
    stack: error.stack,
    userId: req.user.id,
    timestamp: new Date()
  });
  
  // 2. Retornar genérico:
  res.status(400).json({
    error: 'Invalid request',
    message: 'Could not create appointment. Please try again.'
    // Sem detalhes!
  });
}
```

**Checklist:**
- [ ] Logs: armazenam stack trace completo
- [ ] Response: erros genéricos (não stack trace)
- [ ] Logs: sem dados sensíveis (phone, email)
- [ ] Diferentes erros retornam mesma mensagem

---

### 9️⃣ TIMING ATTACKS / RESPONSE TIME

**PROBLEMA:**
POST /api/appointments
Body: { professionalId: 1, serviceId: 999 }
Resposta rápida (50ms):   Service não existe
Resposta lenta (150ms):   Service existe
Resposta muito lenta (200ms): Sem acesso
Atacker deduz:

Quais services existem (pelas diferenças de tempo)
Quais profissionais existem


**PROTEÇÃO:**
Responder com latência consistente
├─ Sempre esperar tempo mínimo (200ms)
├─ Mesmo erro rápido, mesmo sucesso rápido
├─ Impossível deduzir diferenças
└─ Atacker desiste (não consegue mapear)

**Implementação:**
```javascript
const appointmentService = {
  create: async (data) => {
    const startTime = Date.now();
    const minResponseTime = 200; // sempre 200ms mínimo
    
    try {
      // Validações (podem ser rápidas ou lentas)
      const professional = await db.professionals.findUnique({
        where: { id: data.professionalId }
      });
      
      if (!professional) throw new Error('Not found');
      
      const service = await db.services.findUnique({
        where: { id: data.serviceId }
      });
      
      if (!service) throw new Error('Not found');
      
      // ... criar agendamento
      return result;
      
    } catch (error) {
      // ✅ Sempre esperar tempo mínimo (mesmo em erro!)
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, minResponseTime - elapsed);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      throw error;
    }
  }
};
```

**Checklist:**
- [ ] Todas as respostas: latência mínima 200ms
- [ ] Mesmo em erro: latência consistente
- [ ] Redis caching: não expõe timing

---

## 📋 PASSO A PASSO DE IMPLEMENTAÇÃO

Siga **EXATAMENTE** nesta ordem para não embolar:

### FASE 1: SETUP INICIAL (1-2 horas)

#### 1.1 - Clonar/Criar projeto
```bash
mkdir projeto-agendamento-barbeiro
cd projeto-agendamento-barbeiro
git init
```

#### 1.2 - Criar estrutura de pastas
```bash
# Backend
mkdir -p backend/src/{controllers,services,repositories,middleware,dtos/{requests,responses},models,utils,types,config,routes}
mkdir -p backend/prisma/migrations
mkdir -p backend/tests/{unit,integration,security}

# Frontend
mkdir -p frontend/src/{components,pages,hooks,api,types,utils,styles}

# Cloudflare
mkdir -p cloudflare/src cloudflare/rules

# Docs
mkdir -p docs
```

#### 1.3 - Inicializar backend
```bash
cd backend
npm init -y
npm install fastify @fastify/helmet @fastify/cors @fastify/jwt @prisma/client bcrypt redis pino dotenv zod express-rate-limit rate-limit-redis axios
npm install -D typescript @types/node ts-node prisma

# Criar arquivos
touch .env.example tsconfig.json
```

#### 1.4 - Inicializar frontend
```bash
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install axios zod react-router-dom
```

#### 1.5 - Criar .env.example (Backend)
```bash
# Backend env.example
cat > backend/.env.example << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/barbeiro_db"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# JWT
JWT_SECRET="seu-secret-256-bits-aleatorio"
REFRESH_SECRET="seu-refresh-secret-256-bits"

# Encryption
ENCRYPTION_KEY="32-bytes-hex-key-para-aes256"

# Cloudflare
CLOUDFLARE_API_TOKEN="seu-token"
CLOUDFLARE_ZONE_ID="seu-zone-id"

# Environment
NODE_ENV="development"
PORT=3000

# Admin
ADMIN_EMAIL="admin@barbeiro.com"
EOF
```

#### 1.6 - Adicionar ao .gitignore
```bash
echo "claude.md" >> backend/.gitignore
echo ".env" >> backend/.gitignore
echo ".env.local" >> backend/.gitignore
echo "node_modules/" >> backend/.gitignore
echo ".DS_Store" >> backend/.gitignore
```

---

### FASE 2: DATABASE SETUP (30-45 minutos)

#### 2.1 - Instalar PostgreSQL localmente
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Linux (Ubuntu)
sudo apt-get install postgresql postgresql-contrib

# Windows: Download de https://www.postgresql.org/download/windows/
```

#### 2.2 - Criar banco de dados
```bash
createdb barbeiro_db
# ou via psql:
psql -U postgres
CREATE DATABASE barbeiro_db;
\q
```

#### 2.3 - Instalar Prisma
```bash
cd backend
npx prisma init
```

#### 2.4 - Configurar schema Prisma
```bash
# Editar prisma/schema.prisma com modelo completo
```

**COPIE E COLE em `backend/prisma/schema.prisma`:**

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Professional {
  id        String   @id @default(cuid())
  name      String
  email     String?  @unique
  phone     String   @unique
  avatar    String?
  bio       String?
  isActive  Boolean  @default(true)

  appointments Appointment[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([phone])
}

model Service {
  id          String   @id @default(cuid())
  name        String   // "Corte", "Barba", etc
  description String?
  duration    Int      // em minutos
  price       Decimal  @db.Decimal(10, 2)
  isActive    Boolean  @default(true)

  appointments Appointment[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([name])
}

model Appointment {
  id              String   @id @default(cuid())
  
  professionalId  String
  professional    Professional @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  
  serviceId       String
  service         Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  
  dateTime        DateTime
  amount          Decimal  @db.Decimal(10, 2)
  
  // Client info (encriptado)
  phone           String
  name            String
  email           String?
  
  status          String   @default("pending") // pending, confirmed, cancelled
  notes           String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([professionalId])
  @@index([serviceId])
  @@index([dateTime])
  @@index([status])
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hash
  role      String   @default("USER") // USER, ADMIN
  isActive  Boolean  @default(true)
  
  mfaEnabled Boolean @default(false)
  mfaSecret  String?
  
  refreshTokens String[] // Tokens inválidos (blacklist)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}
```

#### 2.5 - Executar migrations
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

#### 2.6 - Criar seed (dados de teste)
```bash
# backend/prisma/seed.ts
```

---

### FASE 3: SEGURANÇA - UTILS (1-2 horas)

#### 3.1 - Criar encryption.ts
```bash
# backend/src/utils/encryption.ts
```

**COPIE E COLE:**

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY deve ter 64 caracteres (32 bytes em hex)');
}

export const encryptData = (data: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

export const decryptData = (data: string): string => {
  const [ivHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
```

#### 3.2 - Criar jwt.ts
```bash
# backend/src/utils/jwt.ts
```

**COPIE E COLE:**

```typescript
import jwt from '@fastify/jwt';

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || '',
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.REFRESH_SECRET || '',
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

export const verifyToken = (token: string, secret: string) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};
```

#### 3.3 - Criar validation.ts
```bash
# backend/src/utils/validation.ts
```

**COPIE E COLE:**

```typescript
import { z } from 'zod';

// Schemas de validação
export const CreateAppointmentSchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  dateTime: z.string().datetime(),
  phone: z.string().regex(/^\d{10,11}$/), // Phone BR
  name: z.string().min(3).max(100),
  email: z.string().email().optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

// Validar se amount vem em request (NUNCA deve vir)
export const rejectAmountInRequest = (data: any) => {
  if (data.amount !== undefined) {
    throw new Error('Price manipulation detected');
  }
};
```

---

### FASE 4: MIDDLEWARE DE SEGURANÇA (1-2 horas)

#### 4.1 - Criar auth.ts
```bash
# backend/src/middleware/auth.ts
```

**COPIE E COLE:**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
};

export const adminMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await db.users.findUnique({
    where: { id: request.user.userId }
  });
  
  if (user?.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Forbidden' });
  }
};
```

#### 4.2 - Criar rateLimiter.ts
```bash
# backend/src/middleware/rateLimiter.ts
```

**COPIE E COLE (código que mostramos antes):**

```typescript
// Usar implementação que mostramos na documentação de rate limiting
```

#### 4.3 - Criar validation.ts (middleware)
```bash
# backend/src/middleware/validation.ts
```

**COPIE E COLE:**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

// Rejeita se amount vem em request
export const rejectAmountMiddleware = (req: FastifyRequest, reply: FastifyReply) => {
  if (req.body && (req.body as any).amount !== undefined) {
    return reply.status(400).json({
      error: 'Invalid request',
      message: 'Price manipulation detected'
    });
  }
};
```

---

### FASE 5: DTOs (30 minutos)

#### 5.1 - Criar requests/CreateAppointmentDto.ts
```bash
# backend/src/dtos/requests/CreateAppointmentDto.ts
```

**COPIE E COLE:**

```typescript
export interface CreateAppointmentDto {
  professionalId: string;  // UUID
  serviceId: string;       // UUID
  dateTime: string;        // ISO 8601
  phone: string;           // "21998217863"
  name: string;            // "João Silva"
  email?: string;          // opcional
  // ❌ NÃO incluir: amount, discount, price
}
```

#### 5.2 - Criar responses/AppointmentResponseDto.ts
```bash
# backend/src/dtos/responses/AppointmentResponseDto.ts
```

**COPIE E COLE:**

```typescript
// Para cliente público
export interface AppointmentResponseDto {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  message: string;
  // ❌ NÃO incluir: amount, phone, createdAt, updatedAt
}

// Para admin (estende public)
export interface AppointmentAdminResponseDto extends AppointmentResponseDto {
  amount: number;
  phone: string;
  name: string;
  professionalId: string;
  serviceId: string;
  dateTime: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### FASE 6: CONTROLLERS (1-2 horas)

#### 6.1 - Criar appointmentController.ts
```bash
# backend/src/controllers/appointmentController.ts
```

**COPIE E COLE:**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateAppointmentSchema, rejectAmountInRequest } from '../utils/validation';
import { appointmentService } from '../services/appointmentService';

export const appointmentController = {
  create: async (req: FastifyRequest, reply: FastifyReply) => {
    // 1. Validar input (DTO)
    const data = CreateAppointmentSchema.parse(req.body);
    
    // 2. Rejeitar se amount vem
    rejectAmountInRequest(req.body);
    
    try {
      // 3. Chamar service (que busca amount do banco)
      const appointment = await appointmentService.create(data);
      
      // 4. Retornar sem dados sensíveis
      return reply.status(201).json({
        id: appointment.id,
        status: 'pending',
        message: 'Agendamento realizado com sucesso!',
        // ❌ NÃO retornar: amount, phone, email
      });
      
    } catch (error) {
      // ❌ NÃO retornar stack trace
      reply.status(400).json({
        error: 'Invalid request',
        message: 'Could not create appointment. Please try again.'
      });
    }
  }
};
```

---

### FASE 7: SERVICES (1-2 horas)

#### 7.1 - Criar appointmentService.ts
```bash
# backend/src/services/appointmentService.ts
```

**COPIE E COLE:**

```typescript
import { appointmentRepository } from '../repositories/appointmentRepository';
import { encryptData } from '../utils/encryption';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export const appointmentService = {
  create: async (data: any) => {
    // 1. Buscar serviço DO BANCO (nunca do cliente)
    const service = await db.services.findUnique({
      where: { id: data.serviceId }
    });
    
    if (!service) {
      throw new Error('Service not found');
    }
    
    // 2. Validar profissional
    const professional = await db.professionals.findUnique({
      where: { id: data.professionalId }
    });
    
    if (!professional) {
      throw new Error('Professional not found');
    }
    
    // 3. Amount vem SEMPRE do banco
    const amount = service.price;
    
    // 4. Encriptar dados sensíveis
    const encryptedPhone = encryptData(data.phone);
    const encryptedName = encryptData(data.name);
    const encryptedEmail = data.email ? encryptData(data.email) : null;
    
    // 5. Salvar agendamento
    const appointment = await appointmentRepository.create({
      professionalId: data.professionalId,
      serviceId: data.serviceId,
      dateTime: new Date(data.dateTime),
      amount,       // Do banco, não do cliente!
      phone: encryptedPhone,
      name: encryptedName,
      email: encryptedEmail,
      status: 'pending'
    });
    
    return appointment;
  }
};
```

---

### FASE 8: ROUTES (30 minutos)

#### 8.1 - Criar routes/appointments.ts
```bash
# backend/src/routes/appointments.ts
```

**COPIE E COLE:**

```typescript
import { FastifyInstance } from 'fastify';
import { appointmentController } from '../controllers/appointmentController';
import { bookingLimiter } from '../middleware/rateLimiter';
import { rejectAmountMiddleware } from '../middleware/validation';

export async function appointmentRoutes(app: FastifyInstance) {
  // POST /api/appointments - Criar agendamento
  app.post(
    '/appointments',
    { preHandler: [bookingLimiter, rejectAmountMiddleware] },
    appointmentController.create
  );
  
  // GET /api/appointments/:id - Ver agendamento (próprio)
  app.get('/appointments/:id', appointmentController.getOne);
}
```

---

### FASE 9: MAIN APP SETUP (30 minutos)

#### 9.1 - Criar backend/src/index.ts
```bash
# backend/src/index.ts
```

**COPIE E COLE:**

```typescript
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { appointmentRoutes } from './routes/appointments';
import { PrismaClient } from '@prisma/client';

const app = Fastify({ logger: true });
const db = new PrismaClient();

const start = async () => {
  // 1. Registrar plugins de segurança
  await app.register(helmet);
  await app.register(cors, {
    origin: [
      'http://localhost:5173', // Vite dev
      process.env.FRONTEND_URL || ''
    ],
    credentials: true
  });
  
  // 2. Registrar JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || '',
    cookie: {
      cookieName: 'accessToken',
      signed: false
    }
  });
  
  // 3. Registrar rotas
  await app.register(appointmentRoutes, { prefix: '/api' });
  
  // 4. Iniciar servidor
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  
  console.log(`🚀 Server running at http://localhost:${port}`);
};

start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.$disconnect();
  await app.close();
  process.exit(0);
});
```

---

### FASE 10: FRONTEND SETUP (1-2 horas)

#### 10.1 - Criar frontend/src/api/client.ts
```bash
# frontend/src/api/client.ts
```

**COPIE E COLE:**

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ Envia cookies automaticamente
  headers: {
    'Content-Type': 'application/json'
  }
});

// ❌ NUNCA incluir token em Authorization header
// Cookies com httpOnly cuidam disso

export default client;
```

#### 10.2 - Criar frontend/src/hooks/useApi.ts
```bash
# frontend/src/hooks/useApi.ts
```

**COPIE E COLE:**

```typescript
import { useState } from 'react';
import client from '../api/client';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (url: string, data: any) => {
    setLoading(true);
    setError(null);
    
    try {
      // ❌ NUNCA incluir amount
      const { amount, ...safeData } = data;
      
      const response = await client.post(url, safeData);
      setLoading(false);
      return response.data;
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao processar requisição');
      setLoading(false);
      throw err;
    }
  };

  return { post, loading, error };
};
```

---

## ✅ CHECKLIST ANTES DE DEPLOY

### Segurança:
- [ ] ❌ Nenhum `amount` no frontend
- [ ] ✅ Todos IDs são UUIDs
- [ ] ✅ Tokens em HttpOnly Cookies
- [ ] ✅ Dados sensíveis (phone, email) encriptados
- [ ] ✅ Rate limiting em todos endpoints
- [ ] ✅ Erros genéricos (sem stack traces)
- [ ] ✅ CORS restritivo
- [ ] ✅ Helmet headers ativados
- [ ] ✅ Validação em 5 camadas

### Environment:
- [ ] ✅ `.env` NÃO está commitado
- [ ] ✅ `.env.example` com exemplos
- [ ] ✅ `claude.md` NÃO está commitado
- [ ] ✅ Variáveis obrigatórias preenchidas

### Database:
- [ ] ✅ Migrations rodaram
- [ ] ✅ Schema Prisma validado
- [ ] ✅ Foreign keys configuradas
- [ ] ✅ Índices criados

### Testes:
- [ ] ✅ Teste: enviar amount modificado → 400 error
- [ ] ✅ Teste: acessar endpoint protegido sem token → 401
- [ ] ✅ Teste: rate limit excedido → 429
- [ ] ✅ Teste: dados pessoais não expostos

### Documentação:
- [ ] ✅ README.md atualizado
- [ ] ✅ API.md com endpoints
- [ ] ✅ DEPLOYMENT.md com steps
- [ ] ✅ claude.md no gitignore

---

## 🐛 TROUBLESHOOTING

### Erro: "ENCRYPTION_KEY deve ter 64 caracteres"
```bash
# Gerar chave correta:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copiar para .env: ENCRYPTION_KEY=<resultado>
```

### Erro: "Cannot find module 'prisma'"
```bash
cd backend
npm install -D prisma
npx prisma generate
```

### Erro: "PostgreSQL not running"
```bash
# macOS:
brew services start postgresql@15

# Linux:
sudo service postgresql start

# Windows:
# Procure pgAdmin ou serviço PostgreSQL
```

### Rate limit não funcionando
```bash
# Verificar Redis:
redis-cli ping
# Deve retornar: PONG
```

### Token expirado constantemente
```bash
# Aumentar JWT_SECRET em .env:
JWT_SECRET="seu-secret-muito-longo-256-bits"
# Mínimo 32 caracteres
```

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

```bash
# 1. Sempre começar com git branch
git checkout -b feature/nova-funcionalidade

# 2. Fazer alterações

# 3. Testar (não commitar .env, claude.md)
npm test

# 4. Commit (excluir files sensíveis)
git add . --except .env claude.md
git commit -m "feat: descrição"

# 5. Push e fazer PR

# 6. Merge após review
```

---

## 📚 REFERÊNCIAS

- [Prisma Docs](https://www.prisma.io/docs)
- [Fastify Docs](https://www.fastify.io)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Rate Limiting Best Practices](https://tools.ietf.org/html/draft-ietf-httpapi-ratelimit-headers)

---

**⚠️ Última atualização: 2026-05-05**
**Versão do projeto: 1.0.0**
**Desenvolvedor: AI Consultant**

---

## 🚀 PRÓXIMOS PASSOS APÓS SETUP INICIAL

1. ✅ Criar endpoints de profissionais (GET)
2. ✅ Criar endpoints de serviços (GET)
3. ✅ Criar endpoints de horários disponíveis (GET)
4. ✅ Criar endpoints de agendamento (POST) com segurança
5. ✅ Criar dashboard de admin
6. ✅ Integrar Cloudflare
7. ✅ Setup CI/CD
8. ✅ Deploy em produção

Siga este documento linha por linha. Não pule etapas!