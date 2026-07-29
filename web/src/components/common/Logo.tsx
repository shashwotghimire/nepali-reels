import logoSrc from "@/assets/logo.png";

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoSrc} alt="Nepali Reels" className="size-7 shrink-0 rounded-md" />
      {!collapsed && (
        <span className="font-semibold text-base tracking-tight">Nepali Reels</span>
      )}
    </div>
  );
}

export default Logo;
