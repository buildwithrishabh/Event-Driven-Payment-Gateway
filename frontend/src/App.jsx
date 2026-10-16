import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import { LoadingBlock } from "./components/ui/Spinner.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import ConnectPage from "./pages/ConnectPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import PaymentDetailPage from "./pages/PaymentDetailPage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import WebhooksPage from "./pages/WebhooksPage.jsx";
import ApiReferencePage from "./pages/ApiReferencePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

/** Reset scroll on navigation. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/** The connect screen bounces to the dashboard when a key is already valid. */
function ConnectRoute() {
  const { isConnected, status, apiKey } = useAuth();
  if (status === "checking" && apiKey) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f7fb]">
        <LoadingBlock label="Restoring your session…" />
      </div>
    );
  }
  if (status === "connected" && isConnected) {
    return <Navigate to="/" replace />;
  }
  return <ConnectPage />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/connect" element={<ConnectRoute />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/:id" element={<PaymentDetailPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="api" element={<ApiReferencePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
