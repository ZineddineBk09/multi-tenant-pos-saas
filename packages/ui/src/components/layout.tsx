import { type HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AppShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-bold text-slate-900">
              {title}
            </a>
            {nav}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export function DataTable({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-slate-50">{children}</tr>;
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

export function TableHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}
