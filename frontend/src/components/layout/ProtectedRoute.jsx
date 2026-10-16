import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { LoadingBlock } from "../ui/Spinner.jsx";

/**
 * Guards dashboard routes. Since the backend has no login endpoint, "logged in"
 * simply means a valid x-api-key is stored and GET /v1/merchants/me succeeded.
 */
export default function ProtectedRoute({ children }) {
  const { isConnected, status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f7fb]">
        <LoadingBlock label="Verifying API key…" />
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/connect" replace state={{ from: location.pathname }} />;
  }

  return children;
}
