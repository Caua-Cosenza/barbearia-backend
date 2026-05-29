# 💈 Barbearia — Backend

API REST para sistema de agendamento online de barbearia, desenvolvido como projeto de portfólio durante o curso de Análise e Desenvolvimento de Software.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-4-000000?style=flat&logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white)

---

## 📋 Sobre o Projeto

Sistema completo de agendamento onde clientes podem marcar horários sem precisar criar conta, e o barbeiro gerencia tudo por um painel administrativo protegido.

> 🟢 **Em produção desde 26/05/2026** — atendendo uma barbearia real com cerca de **300 clientes/mês**.
> O cliente (Jhonatan) relatou que o sistema **superou as expectativas**, tanto em funcionalidade quanto na interface.
> Antes do sistema, o controle de agendamentos era feito manualmente via WhatsApp, sem organização centralizada.

**Principais decisões de arquitetura:**
- Clientes não precisam de login — recebem link de cancelamento via WhatsApp
- Dados sensíveis (nome, telefone, e-mail) criptografados em AES-256-CBC no banco
- Autenticação do admin via JWT em HttpOnly cookies (sem localStorage)
- 3 camadas de rate limit: Cloudflare → Railway → Fastify

---

## ⚙️ Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (Node.js 20) |
| Framework HTTP | Fastify 4 |
| Banco de dados | PostgreSQL 16 |
| ORM | Prisma |
| Cache | Redis (ioredis) |
| Autenticação | JWT + HttpOnly Cookies |
| Criptografia | AES-256-CBC (crypto nativo) |
| Hash de senhas | bcrypt |
| Validação | Zod |
| Logs | Pino + Pino-Pretty |
| Testes | Vitest |
| Deploy | Railway |

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- Node.js 20+
- PostgreSQL rodando localmente (ou via Docker)
- Redis rodando localmente (ou via Docker)

### Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/Caua-Cosneza/barbearia-backend.git
cd barbearia-backend

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores locais

# 4. Rodar as migrations
npx prisma migrate dev

# 5. Iniciar o servidor
npm run dev
```

O servidor sobe em `http://localhost:3333`.

### Subindo banco e cache com Docker (opcional)

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

---

## 🔑 Variáveis de Ambiente

Veja o arquivo `.env.example` para a lista completa. Os valores obrigatórios são:

```env
DATABASE_URL=          # PostgreSQL connection string
REDIS_URL=             # Redis connection string
JWT_SECRET=            # 32+ caracteres aleatórios
JWT_REFRESH_SECRET=    # 32+ caracteres aleatórios (diferente do acima)
ENCRYPTION_KEY=        # 64 hex chars (32 bytes)
CORS_ORIGIN=           # URL do frontend em produção
```

> ⚠️ **Nunca commite o arquivo `.env`**. O `.env.example` contém apenas os nomes das variáveis, sem valores reais.

---

## 📁 Estrutura de Pastas

```
backend/
├── src/
│   ├── routes/          # Rotas da API
│   ├── controllers/     # Lógica de negócio
│   ├── middleware/       # Auth, rate limit, etc.
│   ├── services/        # Integrações (WhatsApp, etc.)
│   ├── utils/           # Funções auxiliares
│   └── server.ts        # Entry point
├── prisma/
│   ├── schema.prisma    # Modelos do banco
│   └── migrations/      # Histórico de migrations
├── .env.example
└── package.json
```

---

## 🔒 Segurança

- **Headers HTTP** seguros via `@fastify/helmet`
- **CORS** configurado apenas para o domínio do frontend
- **Rate limiting** em 3 camadas (Cloudflare / Railway / Fastify)
- **Cookies HttpOnly** — tokens JWT inacessíveis via JavaScript
- **Criptografia AES-256-CBC** para dados PII (nome, telefone, e-mail)
- **Zod** validando todos os inputs da API
- Sem uso de `*` no CORS em produção

---

## 🌐 Endpoints Principais

| Método | Rota | Descrição |
|---|---|---|
| POST | `/agendamentos` | Criar agendamento (público) |
| DELETE | `/agendamentos/cancelar/:token` | Cancelar com token (público) |
| GET | `/admin/agendamentos` | Listar agendamentos (admin) |
| POST | `/admin/login` | Login do administrador |
| GET | `/servicos` | Listar serviços disponíveis |

---

## 🧪 Testes

```bash
npm run test
```

---

## 📄 Licença

MIT

---

> Projeto desenvolvido por **Cauã Cosenza de Carvalho** como portfólio — 2º semestre de Análise e Desenvolvimento de Software.
