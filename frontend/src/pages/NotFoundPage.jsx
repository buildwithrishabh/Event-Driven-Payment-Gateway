import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Card, CardBody } from "../components/ui/Card.jsx";

export default function NotFoundPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f7fb] p-6">
      <div className="pointer-events-none absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />
      <Card className="relative max-w-md shadow-soft">
        <CardBody className="flex flex-col items-center py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-sm">
            <Compass className="h-7 w-7" />
          </span>
          <p className="mt-5 bg-brand-gradient bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            404
          </p>
          <h1 className="mt-2 text-sm font-semibold text-ink-800">Page not found</h1>
          <p className="mt-1 text-sm text-ink-500">
            The page you're looking for doesn't exist in the console.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-[1.06]"
          >
            <Home className="h-4 w-4" />
            Back to overview
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
