# Security Patterns Skill

Ensures all Icefuse code follows mandatory security requirements aligned with enterprise audit standards.

**Standards Compliance:** OWASP Top 10 2024, PCI DSS, GDPR

---

## Authentication & Authorization

### Auth Wrappers (Required on ALL Routes)

```typescript
import { authenticateWithScope, requireSession } from '@/services/api-auth'

// Token or session auth with scope check
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'kits:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }
  // authResult.context.actorId is available
}

// Session only (admin UI operations)
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
}
```

### Scope Checks

```typescript
import { hasScope } from '@/lib/api-token'

// Write implies read
if (!hasScope(scopes, 'kits:read')) {
  return unauthorized()
}
```

## Input Validation (Zod - MANDATORY)

```typescript
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email(),
  amount: z.number().positive().min(0.50).max(1000000),
  sortField: z.enum(['createdAt', 'name', 'total']).default('createdAt'), // Whitelist
})

// In route handler
const parsed = createSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
    { status: 400 }
  )
}
```

### ID Validation

```typescript
import { validatePrefixedId, isValidPrefixedId } from '@/lib/id'

// Zod refinement
const schema = z.object({
  id: z.string().refine(validatePrefixedId('category'), {
    message: 'Invalid category ID format'
  })
})

// Direct check
if (!isValidPrefixedId(id, 'serverIdentifier')) {
  return badRequest()
}
```

### IP Validation

```typescript
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/

ip: z.string().refine(
  (val) => ipv4Regex.test(val) || ipv6Regex.test(val),
  { message: 'Invalid IPv4 or IPv6 address' }
)
```

## Session-Derived IDs (CRITICAL)

**NEVER trust client-supplied userId. ALWAYS derive from session.**

```typescript
// WRONG - IDOR vulnerability
const { userId, data } = await req.json()
await createOrder(userId, data)

// CORRECT - Session-derived
const userId = authResult.context.actorId
const { data } = await req.json()
await createOrder(userId, data)
```

## Audit Logging (Required for ALL Mutations)

```typescript
import { auditCreate, auditUpdate, auditDelete } from '@/services/audit'

// After create
await auditCreate('server_identifier', record.id, authResult.context, { name, ip, port }, request)

// After update
await auditUpdate('server_identifier', record.id, authResult.context, oldValues, newValues, request)

// After delete
await auditDelete('server_identifier', record.id, authResult.context, oldValues, request)
```

## Timing-Safe Comparisons

**For tokens, passwords, API keys, secrets - NEVER use === directly.**

```typescript
import { secureTokenCompare, timingSafeCompare } from '@/lib/security/timing-safe'

// WRONG - Timing attack vulnerable
if (providedToken === storedToken) { ... }

// CORRECT - Timing-safe
if (secureTokenCompare(providedToken, storedToken)) { ... }
```

## Idempotent Operations

```typescript
// Lookup by unique key before creating
const existing = await prisma.serverIdentifier.findFirst({
  where: { ip, port }
})

if (existing) {
  // Update if needed, return existing
  return NextResponse.json({ success: true, data: { id: existing.id, isNew: false } })
}

// Create new
const record = await prisma.serverIdentifier.create({ data: { ... } })
return NextResponse.json({ success: true, data: { id: record.id, isNew: true } }, { status: 201 })
```

## Race Condition Prevention

```typescript
// WRONG - Check and update separate (TOCTOU)
const user = await prisma.user.findUnique({ where: { id } })
if (user.balance >= amount) {
  await prisma.user.update({ where: { id }, data: { balance: user.balance - amount } })
}

// CORRECT - Atomic operation
const result = await prisma.user.updateMany({
  where: { id, balance: { gte: amount } },
  data: { balance: { decrement: amount } }
})
if (result.count === 0) throw new Error('Insufficient balance')
```

## Error Handling (No Silent Failures)

```typescript
// WRONG
try { await process() } catch (e) { }

// CORRECT
try {
  await process()
} catch (error) {
  logger.admin.error('Operation failed', error as Error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } },
    { status: 500 }
  )
}
```

## Security Comment Annotations

```typescript
// SECURITY: Session-derived ID
// SECURITY: Zod validated
// SECURITY: Timing-safe comparison
// SECURITY: Idempotency check
// SECURITY: Audit logged
// SECURITY: Atomic operation
// SECURITY: Fail-closed
```

## Quick Checklist

### Authentication & Authorization
- [ ] Auth wrapper on route (authenticateWithScope/requireSession)
- [ ] Session-derived actor ID (never from request body)
- [ ] Scope check for operation

### Input Validation
- [ ] Zod validation on all inputs (body, query, params)
- [ ] Prefixed ID validation
- [ ] Pagination limits (max 100)
- [ ] Sort field whitelist
- [ ] Input length limits

### Race Conditions
- [ ] Atomic operations for balance/inventory
- [ ] Transactions for multi-step operations
- [ ] Idempotency on critical endpoints
- [ ] Database constraints (UNIQUE, CHECK)

### Data Safety
- [ ] Audit logging on mutations
- [ ] Timing-safe comparison for secrets
- [ ] No empty catch blocks
- [ ] Proper error responses
