import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu, Moon, Sun, User, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WaveMark from "@/components/ui/WaveMark";
import { RippleButton } from "@/components/ui/ripple-button";
import { useVaniAppStore } from "@/stores/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const authenticatedNavLinks = [
  { label: "Home", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Contact", to: "/contact" },
];

const guestNavLinks = [{ label: "Home", to: "/" }];

const GlobalNavbar = () => {
  const user = useVaniAppStore((state) => state.user);
  const theme = useVaniAppStore((state) => state.theme);
  const toggleTheme = useVaniAppStore((state) => state.toggleTheme);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const visibleNavLinks = user ? authenticatedNavLinks : guestNavLinks;

  const userInitial = useMemo(() => {
    if (!user?.email) {
      return "V";
    }

    return user.email.charAt(0).toUpperCase();
  }, [user?.email]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[color:rgba(232,232,240,0.16)] bg-[color:rgba(13,17,23,0.28)] backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <WaveMark className="h-9 w-9" />
            <span className="hidden text-lg text-[var(--color-paper)] md:inline">Vani</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {visibleNavLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    "text-sm transition-colors",
                    isActive ? "text-[var(--color-saffron)]" : "text-[color:rgba(245,240,232,0.82)] hover:text-[var(--color-paper)]",
                  ].join(" ")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:rgba(232,232,240,0.35)] text-[var(--color-paper)]"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(232,232,240,0.35)] bg-[color:rgba(245,240,232,0.08)] text-sm text-[var(--color-paper)]"
                    aria-label="User account"
                  >
                    {userInitial}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(232,232,240,0.35)] bg-[color:rgba(245,240,232,0.08)] text-[var(--color-paper)]"
                  aria-label="Guest profile"
                >
                  <User className="h-4 w-4" />
                </button>
                <RippleButton size="sm" className="bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[color:rgba(245,240,232,0.92)]" onClick={() => navigate("/auth")}>
                  Login / Signup
                </RippleButton>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:rgba(232,232,240,0.35)] text-[var(--color-paper)] md:hidden"
            aria-label="Open navigation menu"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-x-0 top-0 z-[70] overflow-hidden bg-[color:rgba(13,17,23,0.97)] backdrop-blur-xl md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "100vh", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between border-b border-[color:rgba(232,232,240,0.16)] px-4">
              <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                <WaveMark className="h-9 w-9" />
                <span className="text-lg text-[var(--color-paper)]">Vani</span>
              </Link>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:rgba(232,232,240,0.35)] text-[var(--color-paper)]"
                aria-label="Close navigation menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-10">
              <div className="flex flex-col gap-6">
                {visibleNavLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      [
                        "text-3xl leading-none transition-colors",
                        isActive ? "text-[var(--color-saffron)]" : "text-[var(--color-paper)]",
                      ].join(" ")
                    }
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>

              <div className="mt-10">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="mb-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-[color:rgba(232,232,240,0.35)] text-[var(--color-paper)]"
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="mr-2 h-4 w-4" /> Light mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 h-4 w-4" /> Dark mode
                    </>
                  )}
                </button>

                {user ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(232,232,240,0.35)] bg-[color:rgba(245,240,232,0.08)] text-base text-[var(--color-paper)]"
                      aria-label="User account"
                    >
                      {userInitial}
                    </button>
                    <RippleButton
                      className="flex-1 border border-[color:rgba(232,232,240,0.35)] bg-transparent text-[var(--color-paper)] hover:bg-[color:rgba(245,240,232,0.08)]"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </RippleButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(232,232,240,0.35)] bg-[color:rgba(245,240,232,0.08)] text-[var(--color-paper)]"
                      aria-label="Guest profile"
                    >
                      <User className="h-5 w-5" />
                    </button>
                    <RippleButton
                      className="flex-1 bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[color:rgba(245,240,232,0.92)]"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate("/auth");
                      }}
                    >
                      Login / Signup
                    </RippleButton>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalNavbar;
