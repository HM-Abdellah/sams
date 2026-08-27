export function normalizeReportType(type){return type==='annual'?'annual':'attendance';}
export function buildCsv(rows){return rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');}
