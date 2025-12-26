"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Icons as simple SVG components
const Icons = {
  training: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  usage: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  docs: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  robot: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  externalLink: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

interface NavItemConfig {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  external?: boolean;
}

const navItems: NavItemConfig[] = [
  { label: "Overview", href: "/", icon: "usage" },
  { label: "Training Runs", href: "/training-runs", icon: "training" },
  { label: "Tinker Console", href: "https://tinker-console.thinkingmachines.ai/", icon: "robot", external: true },
  { label: "Docs", href: "https://tinker-docs.thinkingmachines.ai/", icon: "docs", external: true },
];

export function Sidebar() {
  const pathname = usePathname();

  // Determine active item from URL
  const getIsActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      data-slot="sidebar"
      className="flex flex-col h-screen w-[var(--sidebar-width)] border-r border-border bg-sidebar sticky top-0"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-4 py-4 border-b border-border hover:bg-sidebar-accent/50 transition-colors">
        <div className="w-8 h-8 rounded-md bg-foreground/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-medium">tviz</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const Icon = Icons[item.icon];
          const isActive = getIsActive(item.href);

          // External links
          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon />
                <span>{item.label}</span>
                <span className="ml-auto">
                  <Icons.externalLink />
                </span>
              </a>
            );
          }

          // Internal links - use Next.js Link
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 text-center text-xs text-muted-foreground leading-relaxed">
        <a href="https://github.com/sdan/tviz" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          Open source
        </a>
        {" · "}
        <a href="https://github.com/sdan/tviz" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          Docs
        </a>
      </div>
    </aside>
  );
}
