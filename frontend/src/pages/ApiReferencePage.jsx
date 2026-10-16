import { useState } from "react";
import { Code2, Lock } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";
import { IMPLEMENTED_ENDPOINTS, PLANNED_ENDPOINTS } from "../lib/constants.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody } from "../components/ui/Card.jsx";

const METHODS = {
  GET: "border-sky-200 bg-sky-50 text-sky-700",
  POST: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PATCH: "border-amber-200 bg-amber-50 text-amber-700",
  DELETE: "border-rose-200 bg-rose-50 text-rose-700",
};

function Method({ method }) {
  return <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${METHODS[method] || "border-ink-200 bg-ink-50 text-ink-600"}`}>{method}</span>;
}

function EndpointRow({ endpoint }) {
  const [open, setOpen] = useState(false);
  return <Card>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-ink-50/50">
      <Method method={endpoint.method} />
      <code className="min-w-0 flex-1 break-all font-mono text-sm font-medium text-ink-800">{endpoint.path}</code>
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-500"><Lock className="h-3 w-3" />{endpoint.auth}</span>
      <span className="text-xs font-medium text-brand-700">{open ? "Hide sample" : "View sample"}</span>
    </button>
    <div className="border-t border-ink-100 px-4 py-3">
      <p className="text-sm text-ink-600">{endpoint.summary}</p>
      {open && <div className="relative mt-3 rounded-lg bg-ink-950">
        <div className="absolute right-2 top-2"><CopyButton value={endpoint.sample} showLabel={false} label="Copy request sample" className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10" /></div>
        <pre className="overflow-x-auto p-4 pr-12 text-xs leading-relaxed text-white"><code>{endpoint.sample}</code></pre>
      </div>}
    </div>
  </Card>;
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
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Gateway Base URL (v1)
              </p>
            </div>
            <code className="block break-all font-mono text-sm font-semibold text-ink-900">
              {API_BASE_URL}
            </code>
          </div>
          <CopyButton value={API_BASE_URL} label="Copy Base URL" />
        </CardBody>
      </Card>

      {/* Available Endpoints */}
      <section aria-labelledby="implemented-endpoints" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 id="implemented-endpoints" className="text-sm font-semibold text-ink-900">
            Available Endpoints ({IMPLEMENTED_ENDPOINTS.length})
          </h2>
          <span className="text-xs text-ink-400">Authenticated with x-api-key</span>
        </div>
        <div className="space-y-3">
          {IMPLEMENTED_ENDPOINTS.map((endpoint) => (
            <EndpointRow key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
          ))}
        </div>
      </section>

      {/* Planned Endpoints */}
      <details className="group rounded-xl border border-ink-200/80 bg-white p-4 transition-colors">
        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-ink-700 select-none">
          <span>Roadmap & Planned Endpoints ({planned.length})</span>
          <span className="text-ink-400 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3.5 space-y-2 text-xs text-ink-500">
          <p>Upcoming capabilities currently under development in the payment engine:</p>
          <ul className="mt-3 divide-y divide-ink-100">
            {planned.map((endpoint) => (
              <li
                key={`${endpoint.method}-${endpoint.path}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Method method={endpoint.method} />
                  <code className="font-mono text-xs font-medium text-ink-800">
                    {endpoint.path}
                  </code>
                </div>
                <span className="text-xs text-ink-500">{endpoint.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
