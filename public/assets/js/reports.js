export function normalizeReportType(type) { return type === 'annual' ? 'annual' : 'attendance'; }
export function buildCsv(rows) { return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n'); }
export function printReport(type='attendance') {
  const title = normalizeReportType(type) === 'annual' ? 'SAMS — Statistiques annuelles' : 'SAMS — Feuille de présence';
  const active = document.querySelector(`[data-panel="${normalizeReportType(type) === 'annual' ? 'statistics' : 'attendance'}"]`);
  if (!active) return;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('La fenêtre de rapport est bloquée par le navigateur.');
  popup.document.write(`<!doctype html><html lang="fr" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:1rem;color:#111}h1{font-size:1.2rem}.report{max-width:100%;overflow:auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px;text-align:center;font-size:8pt}th{background:#eee}@media print{body{margin:0}}</style></head><body><h1>${title}</h1><div class="report">${active.querySelector('.table-scroll')?.innerHTML || active.querySelector('.statistics-grid')?.innerHTML || ''}</div><script>window.onload=()=>window.print();<\/script></body></html>`);
  popup.document.close();
}
