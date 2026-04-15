import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Notebook from "@/pages/Notebook";
import Auth from "@/pages/Auth";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notebook/:id"
        element={
          <ProtectedRoute>
            <Notebook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contact"
        element={
          <ProtectedRoute>
            <Contact />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
