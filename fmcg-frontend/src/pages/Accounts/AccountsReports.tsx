import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { reportsApi, routesApi } from '../../api/services';
import { useEffect } from 'react';
import { RouteDto } from '../../types';

interface ReportCard {
  key: string;
  title: string;
  description: string;
  needsRoute: boolean;
  needsDate: boolean;
  fn: (date: string, routeId?: number) => Promise<Blob>;
  filename: (date: string) => string;
}

const REPORTS: ReportCard[] = [
  {
    key: 'billing',
    title: 'Billing Sheet',
    description: 'Customer-wise billing summary with amounts and dues',
    needsRoute: true,
    needsDate: true,
    fn: reportsApi.billingSheet,
    filename: d => `billing-${d}.pdf`,
  },
  {
    key: 'daily',
    title: 'Daily Summary',
    description: 'End-of-day sales and collection summary',
    needsRoute: false,
    needsDate: true,
    fn: reportsApi.dailySummary,
    filename: d => `daily-summary-${d}.pdf`,
  },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountsReports() {
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [date, setDate] = useState(today());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    routesApi.list().then(setRoutes).catch(() => {});
  }, []);

  const download = async (report: ReportCard) => {
    if (report.needsRoute && !routeId) {
      setErrors(e => ({ ...e, [report.key]: 'Please select a route.' }));
      return;
    }
    setErrors(e => ({ ...e, [report.key]: '' }));
    setDownloading(report.key);
    try {
      const blob = await report.fn(date, routeId ? Number(routeId) : undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename(date);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrors(er => ({ ...er, [report.key]: e.message ?? 'Download failed' }));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-10">
      <div className="px-4 pt-6 pb-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-white">Reports</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Download PDF reports</p>
      </div>

      <div className="px-4 mt-6 space-y-4">
        {/* Global filters */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Date</label>
              <input
                type="date"
                className="input w-full"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Route (for billing sheet)</label>
              <select
                className="input w-full"
                value={routeId}
                onChange={e => setRouteId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select route…</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Report cards */}
        {REPORTS.map(report => (
          <div key={report.key} className="card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                <FileText size={20} className="text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{report.title}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{report.description}</p>
                {errors[report.key] && (
                  <p className="text-xs text-red-400 mt-1">{errors[report.key]}</p>
                )}
              </div>
              <button
                onClick={() => download(report)}
                disabled={downloading === report.key}
                className="btn btn-primary flex items-center gap-2 shrink-0"
              >
                {downloading === report.key
                  ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                  : <><Download size={15} /> Download</>
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
