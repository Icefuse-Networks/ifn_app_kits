# Security Patterns

**OWASP Top 10 2024, PCI DSS, GDPR**

## Auth (Required ALL Routes)

```typescript
// Token/session + scope
const auth = await authenticateWithScope(request, 'kits:write')
if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status })
// Use: auth.context.actorId

// Session only
const auth = await requireSession(request)
if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status })

// Scope check
if (!hasScope(scopes, 'kits:read')) return unauthorized()
```

## Input Validation (Zod - MANDATORY)

```typescript
const schema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email(),
  amount: z.number().positive().min(0.50).max(1000000),
  sortField: z.enum(['createdAt', 'name', 'total']).default('createdAt'),
  id: z.string().refine(validatePrefixedId('category'), { message: 'Invalid ID' }),
  ip: z.string().refine((val) => ipv4Regex.test(val) || ipv6Regex.test(val))
})

const parsed = schema.safeParse(body)
if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() }}, { status: 400 })
```

## Session-Derived IDs (CRITICAL)

**NEVER trust client userId. ALWAYS derive from session.**

```typescript
// WRONG - IDOR vulnerability
const { userId, data } = await req.json()

// CORRECT
const userId = authResult.context.actorId
const { data } = await req.json()
```


## Timing-Safe Comparisons

```typescript
// For tokens, passwords, API keys, secrets
import { secureTokenCompare } from '@/lib/security/timing-safe'

// WRONG - Timing attack vulnerable
if (providedToken === storedToken) { ... }

// CORRECT
if (secureTokenCompare(providedToken, storedToken)) { ... }
```

## Idempotent Operations

```typescript
const existing = await prisma.serverIdentifier.findFirst({ where: { ip, port }})
if (existing) return NextResponse.json({ success: true, data: { id: existing.id, isNew: false }})
const record = await prisma.serverIdentifier.create({ data: { ... }})
return NextResponse.json({ success: true, data: { id: record.id, isNew: true }}, { status: 201 })
```

## Race Condition Prevention

```typescript
// WRONG - TOCTOU
const user = await prisma.user.findUnique({ where: { id }})
if (user.balance >= amount) await prisma.user.update({ where: { id }, data: { balance: user.balance - amount }})

// CORRECT - Atomic
const result = await prisma.user.updateMany({ where: { id, balance: { gte: amount }}, data: { balance: { decrement: amount }}})
if (result.count === 0) throw new Error('Insufficient balance')
```

## Error Handling

```typescript
try {
  await process()
} catch (error) {
  logger.admin.error('Operation failed', error as Error)
  return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' }}, { status: 500 })
}
```

## CSP Headers (Nonce-Based)

```typescript
// middleware.ts
const nonce = crypto.randomBytes(16).toString('base64')
const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'; img-src 'self' blob: data: https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`.replace(/\s{2,}/g, ' ').trim()

const response = NextResponse.next()
response.headers.set('Content-Security-Policy', cspHeader)
response.headers.set('X-Content-Type-Options', 'nosniff')
response.headers.set('X-Frame-Options', 'DENY')
response.headers.set('X-XSS-Protection', '0')
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
```

## CORS (Whitelist Origins)

```typescript
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : ['http://localhost:3000']

export function corsHeaders(origin: string | null) {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  }
}
```

**NEVER use '*' in production**

## React Server Components (CVE-2025-55182)

**Critical RCE (CVSS 10.0) - Upgrade Required:**
- Next.js: 14.2.35+, 15.0.7+, 15.1.11+
- React: 19.0.0-rc-69d4b800-20241021+
- Also: CVE-2025-55183, CVE-2025-55184, CVE-2026-23864

**Taint APIs:**

```typescript
import { experimental_taintObjectReference, experimental_taintUniqueValue } from 'react'

experimental_taintObjectReference('Do not pass sensitive data to client', sensitiveUserData)
experimental_taintUniqueValue('Do not pass API keys to client', process.env, process.env.API_SECRET_KEY)
```

**Server Actions (CSRF Protected):**

```typescript
'use server'
export async function updateUser(formData: FormData) {
  // Origin === Host checked automatically
  const session = await authenticateWithScope(/* ... */)
  if (!session.success) throw new Error('Unauthorized')

  const data = z.object({ name: z.string().min(1).max(255), email: z.string().email() }).parse({
    name: formData.get('name'), email: formData.get('email')
  })

  await db.update(session.userId, data) // Session-derived ID
}
```

## XSS Prevention

```typescript
// SAFE - React escapes by default
<div>{name}</div>

// DANGEROUS - Must sanitize
import DOMPurify from 'isomorphic-dompurify'
const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'], ALLOWED_ATTR: ['href'] })
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

## TypeScript Strict Mode

```json
{
  "compilerOptions": {
    "strict": true, "noImplicitAny": true, "strictNullChecks": true,
    "noUncheckedIndexedAccess": true, "noImplicitReturns": true
  }
}
```

**Catches 80% of runtime errors at compile-time**

**Type-Safe API:**

```typescript
const UserSchema = z.object({ id: z.string(), email: z.string().email(), role: z.enum(['admin', 'user', 'guest']) })
type User = z.infer<typeof UserSchema>

export async function getUser(id: string): Promise<User> {
  const data = await fetch(`/api/users/${id}`).then(r => r.json())
  return UserSchema.parse(data) // Runtime validation
}
```

## Prisma Security

**SQL Injection:**

```typescript
// SAFE
await prisma.user.findMany({ where: { email: userInput }})
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`

// DANGEROUS
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${userInput}'`)
```

**Operator Injection:**

```typescript
// VULNERABLE
await prisma.user.findMany({ where: JSON.parse(request.body) })

// SAFE - Whitelist
const validated = z.object({ email: z.string().email().optional(), role: z.enum(['admin', 'user']).optional() }).parse(input)
await prisma.user.findMany({ where: validated })
```

**PgBouncer:**

```prisma
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")      // Pooled (PgBouncer)
  directUrl = env("DIRECT_URL")  // Direct (migrations)
}
```

```env
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@postgres:5432/db"
```

**Config:** Pool size: `(num_cpus * 2 + 1) / num_instances`, Transaction mode, `max_prepared_statements > 0`

## PostgreSQL Indexes

```sql
-- B-tree (default): CREATE INDEX idx_users_email ON users(email);
-- Partial: CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';
-- Expression: CREATE INDEX idx_users_lower_email ON users(LOWER(email));
-- BRIN (time-series): CREATE INDEX idx_logs_created_brin ON logs USING BRIN(created_at);
-- GIN (JSON/arrays): CREATE INDEX idx_metadata_gin ON products USING GIN(metadata jsonb_path_ops);
-- No locks: CREATE INDEX CONCURRENTLY idx_users_name ON users(name);
```

**Validate:** `EXPLAIN (ANALYZE, BUFFERS) SELECT ...`
**Maintain:** Regular VACUUM, ANALYZE, REINDEX

**Constraints:**

```sql
ALTER TABLE users ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}$');
ALTER TABLE orders ADD CONSTRAINT positive_amount CHECK (amount > 0);
CREATE UNIQUE INDEX idx_unique_server_ip_port ON server_identifiers(ip, port);
```

## Performance (2026 Targets: LCP ≤2.5s, INP ≤200ms, CLS <0.1)

**Images:**

```typescript
<Image src={src} alt={alt} width={800} height={600} priority={false} placeholder="blur" sizes="(max-width: 768px) 100vw, 800px" />
```

**Fonts:**

```typescript
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
<html className={inter.variable}>
```

**Scripts:**

```typescript
<Script src="/analytics.js" strategy="afterInteractive" />
<Script src="/chat.js" strategy="lazyOnload" />
```

**Code Splitting:**

```typescript
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), { loading: () => <p>Loading...</p>, ssr: false })
```

**Server Components (default):**

```typescript
async function UserList() { const users = await db.user.findMany(); return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul> }
```

**Monitor Web Vitals:**

```typescript
useReportWebVitals((m) => fetch('/api/analytics', { method: 'POST', body: JSON.stringify(m) }))
```

## Rate Limiting (Edge)

```typescript
const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '10 s') })

export async function middleware(request: NextRequest) {
  const { success, limit, reset, remaining } = await ratelimit.limit(request.ip ?? '127.0.0.1')
  const response = success ? NextResponse.next() : NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  response.headers.set('X-RateLimit-Limit', String(limit))
  return response
}
```

## Environment Variables

```typescript
const env = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test'])
}).parse(process.env)
```

**Never expose secrets via `NEXT_PUBLIC_*`**

## Security Audit

```bash
npm audit --audit-level=moderate && npm audit fix
snyk test && snyk monitor
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://yourapp.com
```

**ESLint:**

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended", "plugin:security/recommended"],
  "plugins": ["security"],
  "rules": { "security/detect-unsafe-regex": "error", "@typescript-eslint/no-explicit-any": "error" }
}
```

## Data Access Layer (DAL)

```typescript
export const getUser = cache(async (userId: string) => {
  const session = await authenticateWithScope(/* ... */)
  if (!session.success || session.userId !== userId) throw new Error('Unauthorized')
  return await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true }})
})

export async function updateUser(userId: string, data: UpdateUserInput) {
  const session = await authenticateWithScope(/* ... */)
  if (!session.success || session.userId !== userId) throw new Error('Unauthorized')
  const validated = UpdateUserSchema.parse(data)
  const updated = await prisma.user.update({ where: { id: userId }, data: validated })
  return updated
}
```

## Checklist

**Auth:** [ ] Route wrapper [ ] Session-derived ID [ ] Scope check [ ] CSRF protection
**Input:** [ ] Zod validation [ ] ID validation [ ] Pagination limits [ ] Whitelist sort/query fields
**Headers:** [ ] CSP nonces [ ] X-Content-Type-Options [ ] X-Frame-Options [ ] Referrer-Policy
**CORS:** [ ] Specific origins [ ] No wildcards [ ] OPTIONS handler
**XSS:** [ ] No unsanitized dangerouslySetInnerHTML [ ] DOMPurify [ ] Taint APIs [ ] Validate Server Actions
**Race:** [ ] Atomic ops [ ] Transactions [ ] Idempotency [ ] DB constraints
**Data:** [ ] Timing-safe comparison [ ] No empty catch [ ] Proper errors
**TypeScript:** [ ] Strict mode [ ] No any [ ] Runtime validation [ ] Type-safe APIs
**Prisma/PG:** [ ] Parameterized queries [ ] PgBouncer Transaction mode [ ] Indexes [ ] VACUUM/ANALYZE
**Performance:** [ ] next/image [ ] next/font [ ] Dynamic imports [ ] Server Components [ ] Web Vitals (LCP<2.5s, INP<200ms, CLS<0.1)
**Monitoring:** [ ] npm audit [ ] Dependabot [ ] ESLint security [ ] Penetration testing [ ] Env validation [ ] CVE-2025-55182 patched

**Comments:** `// SECURITY: Session-derived ID | Zod validated | Timing-safe | Idempotency check | Atomic operation | Fail-closed`
