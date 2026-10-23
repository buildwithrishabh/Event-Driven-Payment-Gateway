import { useState } from "react";
import { Code2, Lock } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";
import { IMPLEMENTED_ENDPOINTS, PLANNED_ENDPOINTS } from "../lib/constants.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody } from "../components/ui/Card.jsx";

const METHODS = {
  GET: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  POST: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  PATCH: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  DELETE: "border-rose-500/20 bg-rose-500/10 text-rose-400",
};

function Method({ method }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${
        METHODS[method] || "border-[#26282E] bg-[#16171A] text-zinc-300"
      }`}
    >
      {method}
    </span>
  );
}

function EndpointRow({ endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <Method method={endpoint.method} />
        <code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-zinc-100">
          {endpoint.path}
        </code>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <Lock className="h-3 w-3 text-zinc-500" />
          {endpoint.auth}
        </span>
        <span className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
          {open ? "Hide sample" : "View sample"}
        </span>
      </button>
      <div className="border-t border-[#232529] bg-[#111215] px-4 py-3.5">
        <p className="text-xs text-zinc-400 leading-relaxed">{endpoint.summary}</p>
        {open && (
          <div className="relative mt-3 rounded-xl border border-[#232529] bg-[#0C0D0E] p-4">
            <div className="absolute right-2.5 top-2.5">
              <CopyButton
                value={endpoint.sample}
                showLabel={false}
                label="Copy request sample"
              />
            </div>
            <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-300 font-mono">
              <code>{endpoint.sample}</code>
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ApiReferencePage() {
  const planned = Object.values(PLANNED_ENDPOINTS);
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="API reference"
        description="Core REST endpoints, authentication headers, and request schemas."
      />

      {/* Base URL Card */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Gateway Base URL (v1)
              </p>
            </div>
            <code className="block break-all font-mono text-sm font-semibold text-[#F4F4F5]">
              {API_BASE_URL}
            </code>
          </div>
          <CopyButton value={API_BASE_URL} label="Copy Base URL" />
        </CardBody>
      </Card>

      {/* Available Endpoints */}
      <section aria-labelledby="implemented-endpoints" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="implemented-endpoints" className="text-sm font-semibold text-zinc-200">
            Available Endpoints ({IMPLEMENTED_ENDPOINTS.length})
          </h2>
          <span className="font-mono text-xs text-zinc-500">Authenticated with x-api-key</span>
        </div>
        <div className="space-y-3">
          {IMPLEMENTED_ENDPOINTS.map((endpoint) => (
            <EndpointRow key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
          ))}
        </div>
      </section>

      {/* Planned Endpoints */}
      <details className="group rounded-xl border border-[#232529] bg-[#16171A] p-4 transition-colors">
        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-zinc-300 select-none">
          <span>Roadmap & Planned Endpoints ({planned.length})</span>
          <span className="text-zinc-500 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3.5 space-y-2 text-xs text-zinc-400">
          <p className="text-zinc-400">Upcoming capabilities currently under development in the payment engine:</p>
          <ul className="mt-3 divide-y divide-[#232529]">
            {planned.map((endpoint) => (
              <li
                key={`${endpoint.method}-${endpoint.path}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Method method={endpoint.method} />
                  <code className="font-mono text-xs font-medium text-zinc-200">
                    {endpoint.path}
                  </code>
                </div>
                <span className="text-xs text-zinc-400">{endpoint.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
