# Architecture

This document expands on the system design decisions behind the Multi-Tenant POS SaaS platform.

## Design goals

| Goal | How it is achieved |
|------|-------------------|
| Showcase frontend architecture | Next.js Multi-Zones with independent deploys |
| Showcase backend architecture | Fastify gateway + PostgreSQL RLS |
| Showcase DevOps | Path-filtered GitHub Actions per service |
| Safe multi-tenancy | Database-enforced isolation, not app-only filtering |

---

## Layered architecture

```mermaid
flowchart TB
    subgraph Presentation["Presentation layer"]
        direction LR
        P1["Host UI"]
        P2["Inventory UI"]
        P3["Checkout UI"]
    end

    subgraph Application["Application layer"]
        API["REST API · Fastify"]
        Auth["JWT verification"]
        Validate["Zod schemas"]
    end

    subgraph Domain["Domain / data access"]
        Drizzle["Drizzle ORM"]
        TenantCtx["withTenantContext()"]
    end

    subgraph Infrastructure["Infrastructure"]
        PG["PostgreSQL + RLS"]
    end

    P1 & P2 & P3 --> API
    API --> Auth --> Validate
    Validate --> TenantCtx --> Drizzle --> PG
```

---

## Multi-Zones in detail

### Why Multi-Zones (not Module Federation)?

| Approach | Pros | Cons | Used here? |
|----------|------|------|------------|
| **Multi-Zones** | Simple rewrites, full Next.js per zone, easy Vercel deploy | Hard navigation between zones | Yes |
| Module Federation | Runtime remotes, shared deps | Complex webpack config | No |
| npm packages | Easiest monorepo | Weak independent deploy story | Partial (`@pos/ui`) |

### Request routing (local dev)

```mermaid
sequenceDiagram
    participant Browser
    participant Host as apps/web :3000
    participant Zone as apps/inventory :3001

    Browser->>Host: GET /inventory
    Host->>Zone: rewrite → localhost:3001/inventory
    Zone-->>Host: HTML + assets
    Host-->>Browser: Response (same origin)
```

### Zone configuration

| App | `basePath` | Dev port | Rewritten by host |
|-----|------------|----------|-------------------|
| `apps/web` | — | 3000 | — |
| `apps/inventory` | `/inventory` | 3001 | Yes |
| `apps/checkout` | `/checkout` | 3002 | Yes |

---

## Authentication & cross-zone sessions

JWT is stored in **`localStorage`** under the key `pos_auth_token` via `@pos/api-client`.

```mermaid
flowchart LR
    Login["/login on host"] --> Store["localStorage token"]
    Store --> Dash["/dashboard"]
    Store --> Inv["/inventory zone"]
    Store --> Chk["/checkout zone"]
    Inv & Chk --> API["Bearer header on API calls"]
```

Because all zones are served from the **same origin** when using the host rewrites (`localhost:3000`), `localStorage` is shared automatically.

> For production with separate Vercel project URLs behind rewrites, the browser still sees one origin (the host domain), so the same pattern works.

---

## API gateway responsibilities

```mermaid
flowchart TD
    Req["Incoming request"] --> CORS["CORS check"]
    CORS --> Public{"Public route?"}
    Public -->|/health, /tenants, /auth/login| Handler
    Public -->|No| JWT["Verify JWT"]
    JWT -->|Invalid| E401["401 Unauthorized"]
    JWT -->|Valid| Tenant["withTenantContext(tenantId)"]
    Tenant --> Handler["Route handler"]
    Handler --> Zod["Zod validation"]
    Zod --> Drizzle["Drizzle queries inside TX"]
    Drizzle --> Resp["JSON response"]
```

The gateway **never** accepts `tenant_id` from the client for authorization. The tenant always comes from the JWT payload after login.

---

## Package boundaries

```mermaid
flowchart LR
    subgraph "Must not import DB directly"
        web & inventory & checkout
    end

    subgraph "HTTP only"
        api_client["@pos/api-client"]
    end

    subgraph "Server only"
        database["@pos/database"]
        api_svc["services/api"]
    end

    web & inventory & checkout --> api_client
    api_svc --> database
```

| Package | Runs on | Imports database? |
|---------|---------|-------------------|
| `apps/*` | Browser + SSR | No |
| `@pos/api-client` | Browser | No |
| `services/api` | Node.js | Yes |
| `@pos/database` | Node.js | — |

---

## Error handling strategy

| Layer | Behavior |
|-------|----------|
| Zod | `400` with `{ error, details }` |
| Auth | `401` for missing/invalid JWT |
| RLS / not found | `404` when row invisible or missing |
| Business rules | `400` (e.g. insufficient stock) |

---

## Related docs

- [API reference](./api.md)
- [Database & RLS](./database.md)
- [README](../README.md)
