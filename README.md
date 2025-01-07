# Slack Clone

*This is a demo project that is not meant to be used in production*

A real-time communication platform built with the T3 stack (Next.js, tRPC, Prisma) that enables team collaboration through channels and messaging.

## Features

- 🔐 User authentication via Clerk
- 💬 Real-time messaging
- 📢 Public channels
- 👥 Channel member management
- 🔄 Online/offline status
- ✍️ Typing indicators
- ✅ Read receipts

## Tech Stack

- **Framework**: Next.js
- **API**: tRPC
- **Database**: PostgreSQL + Prisma
- **Authentication**: Clerk
- **Real-time**: Pusher

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
4. Initialize the database:
   ```bash
   npx prisma db push
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `CLERK_SECRET_KEY`: Clerk authentication secret
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk frontend key

## License

MIT
