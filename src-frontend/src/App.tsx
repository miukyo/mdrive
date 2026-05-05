import { useEffect } from "react";
import { Route, useLocation } from "wouter";
import Auth from "./pages/Auth";
import { useAuthStore } from "./stores/Auth.store";
import Dashboard from "./pages/Dashboard";
import Share from "./pages/Share";
import { Toast } from "@heroui/react";

function App() {
  const { init, user } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  const [location, navigate] = useLocation();

  useEffect(() => {
    // If it's a public share route, don't redirect
    if (location.startsWith("/share/")) {
      return;
    }

    if (user.username) {
      if (location === "/auth" || location === "/") {
        navigate("/drive");
      }
    } else {
      if (location !== "/auth") {
        navigate("/auth");
      }
    }
  }, [user.username, navigate, location]);

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
