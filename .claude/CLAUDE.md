# Icefuse Kit Manager - Claude Context

## Overview

Kit management system for Icefuse Networks game servers. Admin-only access with Steam authentication via Auth V2.

## Tech Stack

| Tech | Version |
|------|---------|
| Next.js | 15.1.6 |
| React | ^19.0.0 |
| Tailwind | ^3.4.17 |
| TypeScript | ^5 |
| Prisma | ^6.8.2 |
| NextAuth | ^4.24.11 |
| Zod | ^3.24.1 |
| Lucide | ^0.469.0 |

## Authentication

Uses external Auth V2 server (`auth.icefuse.com`) for Steam authentication.

### Auth Flow
1. User visits app → redirected to Auth V2 `/signin`
2. User authenticates via Steam
3. Auth V2 redirects to `/api/auth/callback`
4. Callback creates local NextAuth session
5. All routes check for admin permissions

### Admin-Only Access
ALL pages require admin permissions. Middleware checks `session.user.rank` against Auth V2 permission system.

## Environment Variables

See `.env.example` for required configuration:
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_SECRET` - Session encryption
- `NEXTAUTH_URL` - App URL
- `AUTH_BOOTSTRAP_TOKEN` - Auth V2 handshake
- `AUTH_USER_SYNC_SECRET` - Webhook verification

## Development

```bash
npm install
npm run dev     # Start dev server (port 3020)
npm run build   # Production build
npm run lint    # ESLint check
```

## Database

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
```

## Key Directories

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── config/        # Configuration files
├── lib/           # Utilities and helpers
├── services/      # Business logic
└── types/         # TypeScript types
```

## Deployment

Deployed via Dokploy at `kits.icefuse.com`

## Related Services

- Auth V2: `auth.icefuse.com` (authentication)
- CMS: `cms.icefuse.com` (content management)
- Store: `store.icefuse.com` (PayNow store)
