"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearToken, getApiUrl, getToken } from "@pos/api-client";
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

// The shop's own visiting card image, loaded with the login token (an <img> tag cannot send it).
function VisitingCard() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let objectUrl: string | null = null;

    fetch(`${getApiUrl()}/stores/current/card`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (!src) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visiting Card</CardTitle>
        <CardDescription>The card this store was registered from.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Store visiting card" className="max-h-64 w-auto rounded-md border" />
      </CardContent>
    </Card>
  );
}

// Lets the owner replace the temporary password they were given at registration.
function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setMessage("");
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setMessage("✔ Password changed.");
    } catch (err) {
      setMessage(`❌ ${err instanceof Error ? err.message : "Could not change password"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Replace the temporary password with your own (min. 8 characters).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          type="password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <Button onClick={submit} disabled={saving || !current || next.length < 8}>
          {saving ? "Saving..." : "Change password"}
        </Button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </CardContent>
    </Card>
  );
}

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
        <VisitingCard />
        <ChangePassword />
      </div>
    </AppShell>
  );
}
