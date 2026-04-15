import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppRoutes } from "@/app/AppRoutes";
import GlobalNavbar from "@/components/layout/GlobalNavbar";
import { useVaniAppStore } from "@/stores/appStore";

const THEME_STORAGE_KEY = "vani-theme";

const AppShell = () => {
  const location = useLocation();
  const theme = useVaniAppStore((state) => state.theme);
  const isNotebookRoute = location.pathname.startsWith("/notebook/");
  const shouldShowNavbar = location.pathname !== "/auth" && !isNotebookRoute;

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {shouldShowNavbar && <GlobalNavbar />}
      <div className={shouldShowNavbar ? "pt-16" : undefined}>
        <AppRoutes />
      </div>
    </div>
  );
};

export default AppShell;
