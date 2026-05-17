import { useEffect } from "react";
import { Route, useLocation } from "wouter";
import Auth from "./pages/Auth";
import { useAuthStore } from "./stores/Auth.store";
import { useThemeStore } from "./stores/Theme.store";
import Dashboard from "./pages/Dashboard";
import Share from "./pages/Share";
import { Spinner, Toast } from "@heroui/react";

function App() {
  const { init } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
    init();
  }, []);

  const { user, isInitialLoading, loadingMessage } = useAuthStore();
  const [location, navigate] = useLocation();

  useEffect(() => {
    // If it's a public share route, don't redirect
    if (location.startsWith("/share/")) {
      return;
    }

    if (isInitialLoading) return;

    if (user.firstName) {
      if (location === "/auth" || location === "/") {
        navigate("/drive");
      }
    } else {
      if (location !== "/auth") {
        navigate("/auth");
      }
    }
  }, [user.firstName, navigate, location, isInitialLoading]);

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
        <div className="relative size-12 animate-spin">
          <Spinner size="lg" />
        </div>
        <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h2 className="text-2xl font-bold tracking-tight">MDrive</h2>
          <p className="text-muted text-sm mt-2 font-medium animate-pulse">
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast.Provider placement="bottom end" />
      <Route path="/auth">
        <Auth />
      </Route>
      <Route path="/drive" nest>
        <Dashboard />
      </Route>
      <Route path="/share/:token">
        <Share />
      </Route>
    </>
  );
}

export default App;
