function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect width="28" height="28" rx="6" fill="hsl(var(--primary))" />
        <path
          d="M8 8v12l5-3.5L18 20V8l-5 3.5L8 8z"
          fill="hsl(var(--primary-foreground))"
        />
        <circle cx="20" cy="9" r="2.5" fill="hsl(var(--primary-foreground))" opacity="0.7" />
      </svg>
      {!collapsed && (
        <span className="font-semibold text-base tracking-tight">Nepali Reels</span>
      )}
    </div>
  );
}

export default Logo;
