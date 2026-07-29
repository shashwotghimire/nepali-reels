import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t bg-background px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Nepali Reels. All rights reserved.</span>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
