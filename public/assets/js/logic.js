export const PERIODS=Array.from({length:8},(_,i)=>i+1); export const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat'];
export function calculateAttendancePercentage(present,total){if(!Number.isFinite(present)||!Number.isFinite(total)||total<=0)return 0;return Math.max(0,Math.min(100,(present/total)*100));}
export function key(studentId,date,period){return `${studentId}|${date}|${period}`;}
export function mapAttendance(rows){const m=new Map();for(const r of rows)m.set(key(r.student_id,r.attendance_date,r.period),r.status);return m;}
