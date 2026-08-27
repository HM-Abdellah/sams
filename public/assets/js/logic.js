export const DAYS = Object.freeze(['Lun','Mar','Mer','Jeu','Ven','Sam']);
export const PERIODS = Object.freeze([
  '08:00–09:00','09:00–10:00','10:00–11:00','11:00–12:00',
  '14:00–15:00','15:00–16:00','16:00–17:00','17:00–18:00'
]);

export function dateFromWeek(weekStart, offset) {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function attendanceKey(studentId, date, period) {
  return `${studentId}|${date}|${period}`;
}

export function mapAttendance(rows = []) {
  const map = new Map();
  for (const row of rows) {
    map.set(attendanceKey(row.student_id, row.attendance_date, Number(row.period)), row.status);
  }
  return map;
}

export function countsForStudent(studentId, rows = []) {
  const own = rows.filter(r => Number(r.student_id) === Number(studentId));
  return {
    present: own.filter(r => r.status === 'present').length,
    absent: own.filter(r => r.status === 'absent').length,
    other: own.filter(r => r.status === 'late' || r.status === 'excused').length,
    total: own.length,
  };
}

export function attendanceRate(present, total) {
  if (!Number.isFinite(present) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, present / total * 100)) * 10) / 10;
}

export function isRisk(studentId, rows, threshold = 8) {
  return countsForStudent(studentId, rows).absent >= threshold;
}

export function displayName(student) {
  return [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
}
