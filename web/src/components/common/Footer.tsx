const LEGAL_BASE = "https://shashwotghimire.github.io/nepali-reels-legal";

export default function Footer() {
  return (
    <footer className="border-t bg-background px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Nepali Reels. All rights reserved.</span>
        <div className="flex gap-4">
          <a
            href={`${LEGAL_BASE}/terms-of-service.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
          <a
            href={`${LEGAL_BASE}/privacy-policy.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
