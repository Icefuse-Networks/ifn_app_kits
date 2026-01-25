import Link from "next/link";
import { legalRoutes } from "@/config/routes";

export function Footer() {
  return (
    <footer className="portal-footer">
      <div className="portal-footer-inner">
        <p className="portal-footer-text">
          &copy; {new Date().getFullYear()} Icefuse Networks
        </p>
        <div className="portal-footer-links">
          <Link href={legalRoutes.terms} className="portal-footer-link">
            Terms of Service
          </Link>
          <Link href={legalRoutes.privacy} className="portal-footer-link">
            Privacy Policy
          </Link>
          <Link href={legalRoutes.refunds} className="portal-footer-link">
            Refund Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
