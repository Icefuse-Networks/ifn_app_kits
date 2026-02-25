import Link from "next/link";
import { legalRoutes } from "@/config/routes";

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`py-8 px-6 text-center flex-shrink-0 relative z-[1] mt-auto border-t border-[var(--border-secondary)] ${className}`}
      style={{ background: "rgba(26, 26, 46, 0.95)" }}
    >
      <div className="max-w-[80rem] mx-auto space-y-4">
        <div className="flex flex-wrap justify-center gap-6">
          <Link
            href={legalRoutes.terms}
            className="text-[0.8125rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text-primary)]"
          >
            Terms of Service
          </Link>
          <Link
            href={legalRoutes.privacy}
            className="text-[0.8125rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text-primary)]"
          >
            Privacy Policy
          </Link>
          <Link
            href={legalRoutes.refunds}
            className="text-[0.8125rem] text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text-primary)]"
          >
            Refund Policy
          </Link>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} Icefuse Networks
        </p>
      </div>
    </footer>
  );
}
