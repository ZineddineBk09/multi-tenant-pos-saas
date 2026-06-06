"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@pos/api-client";
import type { AuthResponse, Tenant } from "@pos/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@pos/ui";

export default function LoginPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [email, setEmail] = useState("owner@acme.demo");
  const [password, setPassword] = useState("demo1234");
  const [tenantSlug, setTenantSlug] = useState("acme-retail");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Tenant[] }>("/tenants")
      .then((res) => setTenants(res.data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to POS</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="tenant">Store</Label>
              <Select
                id="tenant"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.name}
                  </option>
                ))}
                {tenants.length === 0 && (
                  <>
                    <option value="acme-retail">Acme Retail</option>
                    <option value="corner-cafe">Corner Cafe</option>
                  </>
                )}
              </Select>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo: owner@acme.demo / demo1234
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
