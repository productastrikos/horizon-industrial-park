import { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Download, FileText, FileSpreadsheet, CalendarRange, Sparkles } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';
import { useWorkOrders } from '../../store/workorders';
import { PERIODS, REPORT_HISTORY_START, buildReport, exportReportCsv, exportReportPdf, keyOf } from '../../lib/report';
import { fmt, pct, inr } from '../../lib/format';

export default function ExportReport() {
  const open = useUi((s) => s.exportOpen);
  const setOpen = useUi((s) => s.setExportOpen);
  const snapshot = useLive((s) => s.snapshot);
  const advisories = useLive((s) => s.advisories);
  const workOrders = useWorkOrders((s) => s.list);
  const { pathname } = useLocation();
  const [scope, setScope] = useState('malur');
  const [period, setPeriod] = useState('7d');
  const [format, setFormat] = useState('pdf');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setScope(pathname === '/portfolio' ? 'portfolio' : 'malur');
    setMsg('');
    if (snapshot && !to) { const today = keyOf(snapshot.ts); setTo(today); setFrom(keyOf(snapshot.ts - 13 * 86400000)); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const rep = useMemo(() => (open && snapshot ? buildReport({ periodId: period, customFrom: from, customTo: to, snapshot, workOrders, advisories }) : null),
    [open, period, from, to, snapshot?.seq, workOrders, advisories]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !snapshot) return null;
  const today = keyOf(snapshot.ts);
  const t = rep.total;
  const doExport = () => {
    if (format === 'csv') { exportReportCsv(rep, scope); setMsg('CSV downloaded — opens in Excel.'); } else {
      const ok = exportReportPdf(rep, scope);
      setMsg(ok ? 'Report opened in a new tab — choose “Save as PDF” in the print dialog.' : 'Pop-up blocked — allow pop-ups for this site and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[640px] card shadow-pop overflow-hidden animate-fade-up">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-center gap-3">
          <span className="h-9 w-9 rounded-lg bg-brand text-white flex items-center justify-center"><Download size={17} /></span>
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Export report</div>
            <div className="text-[12px] text-faint">Daily to overall history · PDF (print-ready) or CSV (Excel)</div>
          </div>
          <button type="button" className="icon-btn h-8 w-8" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="label-xs mb-1.5">Report scope</div>
            <div className="grid grid-cols-2 gap-2">
              {[['portfolio', 'Executive — whole portfolio'], ['malur', 'HIP Malur — facility management']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setScope(id)} className={`rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition ${scope === id ? 'border-brand bg-brand-soft text-fg' : 'border-line text-muted hover:bg-surface-3'}`}>{label}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="label-xs mb-1.5">Period</div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                  className={`chip h-8 px-3 text-[12.5px] border transition ${period === p.id ? 'bg-brand text-white border-brand' : 'bg-surface-2 text-muted border-line hover:text-fg'}`}>
                  {p.id === 'custom' && <CalendarRange size={13} />}{p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="text-[12px] text-muted">From<input type="date" className="input h-10 mt-1" min={REPORT_HISTORY_START} max={today} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="text-[12px] text-muted">To<input type="date" className="input h-10 mt-1" min={REPORT_HISTORY_START} max={today} value={to} onChange={(e) => setTo(e.target.value)} /></label>
              </div>
            )}
          </div>

          <div>
            <div className="label-xs mb-1.5">Format</div>
            <div className="grid grid-cols-2 gap-2">
              {[['pdf', 'PDF report', 'KPI tiles, Sia summary, breakdown, work orders', FileText], ['csv', 'CSV / Excel', 'Raw rows for analysis', FileSpreadsheet]].map(([id, label, sub, Icon]) => (
                <button key={id} type="button" onClick={() => setFormat(id)} className={`rounded-lg border px-3 py-2.5 text-left transition flex items-start gap-2.5 ${format === id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-3'}`}>
                  <Icon size={18} className={format === id ? 'text-brand mt-0.5' : 'text-muted mt-0.5'} />
                  <span><span className="block text-[13px] font-semibold">{label}</span><span className="block text-[11.5px] text-faint">{sub}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold">{rep.fromLabel} – {rep.toLabel}</span>
              <span className="text-faint">{rep.span} day(s) · {rep.grain.toLowerCase()} rows · {rep.rows.length} lines</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2.5 text-[12px]">
              {(scope === 'portfolio'
                ? [['Network trucks', fmt(t.pfTrucks)], ['Occupancy', pct(t.pfOccupancy, 1)], ['Energy', `${fmt(t.pfEnergyMwh)} MWh`], ['Critical alerts', fmt(t.pfCritical)]]
                : [['Truck entries', fmt(t.trucksIn)], ['Avg gate wait', `${fmt(t.avgWaitMin, 1)} min`], ['Tanker spend', inr(t.waterCost)], ['WOs raised', fmt(t.woRaised)]]
              ).map(([k, v]) => <div key={k}><div className="text-faint text-[11px]">{k}</div><div className="font-semibold num">{v}</div></div>)}
            </div>
            <div className="text-[11px] text-plum mt-2 flex items-center gap-1"><Sparkles size={11} />Includes Sia’s written summary and recommendations (PDF)</div>
          </div>
          {msg && <div className="text-[12.5px] text-ok font-semibold">{msg}</div>}
        </div>

        <div className="px-5 py-3 border-t border-line flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
          <button type="button" className="btn-primary" onClick={doExport}><Download size={15} />Export {format.toUpperCase()}</button>
        </div>
      </div>
    </div>
  );
}
