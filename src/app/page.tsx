import { Package } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <main className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--accent-primary-bg)] mb-6">
          <Package className="w-8 h-8 text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          Icefuse Kit Manager
        </h1>
        <p className="text-[var(--text-secondary)]">
          Kit management system for Icefuse Networks
        </p>
      </main>
    </div>
  );
}
