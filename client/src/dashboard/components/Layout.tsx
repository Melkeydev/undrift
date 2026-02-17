import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview", icon: "\u25C8" },
  { to: "/time-tracking", label: "Time Tracking", icon: "\u29D7" },
  { to: "/achievements", label: "Achievements", icon: "\u2726" },
  { to: "/sessions", label: "Sessions", icon: "\u25CE" },
  { to: "/settings", label: "Settings", icon: "\u2699" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/time-tracking": "Time Tracking",
  "/sessions": "Sessions",
  "/achievements": "Achievements",
  "/settings": "Settings",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard";

  return (
    <div className="flex h-full relative z-1">
      <aside
        className={`w-[var(--sidebar-width)] bg-bg-elevated border-r border-border-subtle flex flex-col shrink-0 relative z-10 sidebar-glow max-md:fixed max-md:left-0 max-md:inset-y-0 max-md:z-100 max-md:transition-transform max-md:duration-250 max-md:ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? "max-md:sidebar-mobile-open" : "max-md:sidebar-mobile-closed max-md:shadow-none"}`}
      >
        <div className="px-6 pt-7 pb-6 border-b border-border-subtle">
          <h1 className="font-display text-2xl font-semibold text-text-heading tracking-tight">
            Un<span className="text-accent-ember">drift</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3.5 py-2.5 px-4 text-[13.5px] tracking-wide rounded-sm relative transition-all duration-200 no-underline ${
                  isActive
                    ? "text-accent-ember bg-accent-ember-glow font-medium nav-active-bar"
                    : "text-text-secondary font-normal hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className={`text-lg w-5.5 text-center shrink-0`}>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 pt-4 pb-5 border-t border-border-subtle text-[11px] text-text-muted tracking-widest uppercase">
          Undrift v2.0
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto flex flex-col bg-bg-primary relative main-glow">
        <header className="flex justify-between items-center px-10 py-5 border-b border-border-subtle bg-[rgba(12,12,18,0.8)] backdrop-blur-[12px] sticky top-0 z-5 max-md:px-4 max-md:py-3.5">
          <div className="flex items-center gap-3">
            <button
              className="hidden max-md:flex bg-transparent border border-border-subtle text-text-primary text-lg px-2.5 py-1.5 rounded-sm hover:bg-[rgba(255,255,255,0.05)] transition-colors duration-150"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              &#9776;
            </button>
            <h2 className="font-display text-[22px] font-normal text-text-heading tracking-tight">
              {pageTitle}
            </h2>
          </div>
        </header>
        <div className="px-10 pt-9 pb-12 flex-1 relative z-1 max-w-[1200px] w-full max-md:px-4 max-md:pt-5 max-md:pb-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
