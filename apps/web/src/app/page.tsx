import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pos/ui";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-xl font-bold text-slate-900">POS SaaS</span>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <Badge className="mb-4">Portfolio Project</Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Multi-Tenant SaaS Point-of-Sale
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            A scalable POS platform demonstrating Next.js Multi-Zones microfrontends,
            Node.js API gateway, and PostgreSQL row-level security for tenant isolation.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Zones Frontend</CardTitle>
              <CardDescription>
                Host app routes to independently deployable Inventory and Checkout zones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm text-slate-600">/inventory · /checkout</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Gateway</CardTitle>
              <CardDescription>
                Fastify gateway resolves tenant from JWT and sets PostgreSQL session context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm text-slate-600">set_config(&apos;app.current_tenant_id&apos;)</code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Row-Level Security</CardTitle>
              <CardDescription>
                Single schema, tenant_id on every row, RLS policies enforce isolation at the database layer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm text-slate-600">FORCE ROW LEVEL SECURITY</code>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 rounded-xl border border-slate-200 bg-white p-8">
          <h2 className="mb-4 text-xl font-semibold">Architecture</h2>
          <pre className="overflow-x-auto text-sm text-slate-600">
{`Browser → Host (apps/web) ──rewrites──► Inventory Zone (apps/inventory)
                    └──rewrites──► Checkout Zone (apps/checkout)
                    └──API calls──► Gateway (services/api) ──RLS──► PostgreSQL`}
          </pre>
        </div>
      </main>
    </div>
  );
}
