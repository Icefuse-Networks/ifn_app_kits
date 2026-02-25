import { Package, Settings, Server, Shield } from "lucide-react";
import { Header } from "@/components/global/Header";
import { Footer } from "@/components/global/Footer";
import { PageBackground } from "@/components/global/PageBackground";

export default function Home() {
  return (
    <PageBackground className="portal-root">
      <Header />

      {/* Main Content with padding for fixed header */}
      <main className="pt-20">
        {/* Hero Section */}
        <section className="portal-band portal-band--hero">
          <div className="portal-band-inner text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-primary-bg)] mb-6">
              <Package className="w-10 h-10 text-[var(--accent-primary)]" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Kit Manager
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Manage and configure kits for Icefuse Networks game servers.
              Create, edit, and deploy kit configurations with ease.
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section className="portal-band">
          <div className="portal-band-inner">
            <div className="portal-value-grid">
              <div className="portal-value-card">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center mb-4">
                  <Package className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Kit Management
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Create and manage kit configurations for your game servers
                </p>
              </div>

              <div className="portal-value-card">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center mb-4">
                  <Settings className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Easy Configuration
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Visual editor for kit items, cooldowns, and permissions
                </p>
              </div>

              <div className="portal-value-card">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center mb-4">
                  <Server className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Multi-Server
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Deploy kits across multiple game servers seamlessly
                </p>
              </div>

              <div className="portal-value-card">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Admin Only
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Secure access restricted to authorized administrators
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </PageBackground>
  );
}
