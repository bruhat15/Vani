import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { RippleButton } from "@/components/ui/ripple-button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-navy)] px-6 text-[var(--color-paper)]">
      <div className="text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.16em] text-[var(--color-saffron)]">404</p>
        <h1 className="mb-3 text-5xl">Page not found</h1>
        <p className="mb-6 text-[color:rgba(245,240,232,0.8)]">The route {location.pathname} does not exist.</p>
        <RippleButton
          className="bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Return home
        </RippleButton>
      </div>
    </div>
  );
};

export default NotFound;
