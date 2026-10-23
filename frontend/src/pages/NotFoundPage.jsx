import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Card, CardBody } from "../components/ui/Card.jsx";

export default function NotFoundPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0C0D0E] p-6">
      <Card className="relative max-w-md shadow-card border-[#232529] bg-[#16171A]">
        <CardBody className="flex flex-col items-center py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white">
            <Compass className="h-7 w-7" />
          </span>
          <p className="mt-5 text-4xl font-extrabold tracking-tight text-[#F4F4F5]">
            404
          </p>
          <h1 className="mt-2 text-sm font-semibold text-[#F4F4F5]">Page not found</h1>
          <p className="mt-1 text-sm text-zinc-400">
            The page you're looking for doesn't exist in the console.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500"
          >
            <Home className="h-4 w-4" />
            Back to overview
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
