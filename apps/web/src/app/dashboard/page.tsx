"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearToken, getToken } from "@pos/api-client";
import type { Tenant, User } from "@pos/types";
import {
  AppShell,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@pos/ui";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }

    apiFetch<{ user: User; tenant: Tenant }>("/auth/me")
      .then((res) => {
        setUser(res.user);
        setTenant(res.tenant);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <AppShell
      title="POS SaaS"
      nav={
        <nav className="flex gap-4 text-sm">
          <a href="/dashboard" className="font-medium text-slate-900">
            Dashboard
          </a>
          <a href="/inventory" className="text-slate-600 hover:text-slate-900">
            Inventory
          </a>
          <a href="/checkout" className="text-slate-600 hover:text-slate-900">
            Checkout
          </a>
        </nav>
      }
    >
      <PageHeader
        title={`Welcome${user ? `, ${user.name}` : ""}`}
        description={tenant ? `${tenant.name} · ${tenant.plan} plan` : "Loading..."}
        actions={
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <a href="/inventory">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Inventory Manager</CardTitle>
              <CardDescription>
                Manage products, categories, and stock levels. Microfrontend zone deployed independently.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button>Open Inventory →</Button>
            </CardContent>
          </Card>
        </a>

        <a href="/checkout">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Checkout Terminal</CardTitle>
              <CardDescription>
                POS-style checkout flow with cart, tax calculation, and receipt generation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button>Open Checkout →</Button>
            </CardContent>
          </Card>
        </a>
      </div>
    </AppShell>
  );
}
