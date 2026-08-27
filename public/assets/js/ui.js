import { state } from './state.js';
import { DAYS, PERIODS, attendanceKey, countsForStudent, attendanceRate, isRisk, displayName } from './logic.js';

const esc = value => { const d = document.createElement('div'); d.textContent = String(value ?? ''); return d.innerHTML; };

export const ui = {
  toast(message, error = false) {
    const el = document.querySelector('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show${error ? ' error-toast' : ''}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = 'toast'; }, 2600);
  },

  classes() {
    const select = document.querySelector('#classSelect');
    if (!select) return;
    select.innerHTML = '';
    for (const c of state.classes) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name;
      select.appendChild(option);
    }
    if (state.classId) select.value = String(state.classId);
  },

  attendance() {
    const head = document.querySelector('#attendanceHead');
    const body = document.querySelector('#attendanceBody');
    if (!head || !body) return;
    const rows = state.attendance;
    const map = new Map(rows.map(r => [attendanceKey(r.student_id, r.attendance_date, Number(r.period)), r.status]));
    const days = DAYS.map((name, offset) => ({name, date: addDays(state.weekStart, offset)}));

    head.innerHTML = '<tr><th class="sticky student-col">Élève</th>' + days.flatMap(day => PERIODS.map((p, i) => `<th title="${day.date} · ${p}">${day.name}<br><small>${p}</small></th>`)).join('') + '</tr>';
    body.innerHTML = '';

    const search = state.search.trim().toLowerCase();
    const filtered = state.students.filter(st => {
      const name = displayName(st).toLowerCase();
      if (search && !name.includes(search)) return false;
      if (state.filter === 'risk' && !isRisk(st.id, rows)) return false;
      if (state.filter === 'committed') {
        const c = countsForStudent(st.id, rows);
        if (c.total > 0 && c.absent > 0) return false;
      }
      return true;
    });

    for (const [index, st] of filtered.entries()) {
      const tr = document.createElement('tr');
      const c = countsForStudent(st.id, rows);
      const name = document.createElement('th');
      name.className = 'sticky student-col';
      name.innerHTML = `<span>${index + 1}. ${esc(displayName(st))}</span><small>${c.absent} absence(s)</small>`;
      tr.appendChild(name);

      for (const day of days) {
        for (let p = 1; p <= PERIODS.length; p++) {
          const td = document.createElement('td');
          const status = map.get(attendanceKey(st.id, day.date, p)) || '';
          td.className = `attendance-cell ${status}`;
          td.dataset.student = st.id;
          td.dataset.date = day.date;
          td.dataset.period = String(p);
          td.textContent = status === 'present' ? '✓' : status === 'absent' ? '✕' : status === 'late' ? 'L' : status === 'excused' ? 'E' : '·';
          td.title = `${displayName(st)} · ${day.date} · ${PERIODS[p-1]} · ${status || 'non marqué'}`;
          tr.appendChild(td);
        }
      }
      body.appendChild(tr);
    }
    if (!filtered.length) body.innerHTML = '<tr><td class="empty-state" colspan="49">Aucun élève ne correspond aux filtres.</td></tr>';
    this.stats();
  },

  students() {
    const box = document.querySelector('#studentsList');
    const count = document.querySelector('#studentCount');
    if (!box) return;
    if (count) count.textContent = `${state.students.length} élève(s)`;
    box.innerHTML = '';
    for (const st of state.students) {
      const item = document.createElement('article');
      item.className = 'student-card';
      item.innerHTML = `<div><strong>${esc(displayName(st))}</strong><small>${esc(st.student_number || 'Sans numéro')}</small></div><button class="btn danger small" data-delete-student="${st.id}" type="button">Supprimer</button>`;
      box.appendChild(item);
    }
  },

  stats() {
    let present = 0, absent = 0, other = 0;
    for (const r of state.attendance) {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else other++;
    }
    const total = present + absent + other;
    document.querySelector('#statPresent').textContent = present;
    document.querySelector('#statAbsent').textContent = absent;
    document.querySelector('#statOther').textContent = other;
    document.querySelector('#statRate').textContent = `${attendanceRate(present, total)}%`;
  },

  statistics() {
    const box = document.querySelector('#statisticsGrid');
    if (!box) return;
    box.innerHTML = '';
    for (const st of state.students) {
      const c = countsForStudent(st.id, state.attendance);
      const total = c.present + c.absent + c.other;
      const card = document.createElement('article');
      card.className = `stat-card ${c.absent >= 8 ? 'risk' : ''}`;
      card.innerHTML = `<strong>${esc(displayName(st))}</strong><span>${c.absent} absence(s)</span><span>${c.present} présence(s)</span><b>${attendanceRate(c.present, total)}%</b>`;
      box.appendChild(card);
    }
  }
};

function addDays(iso, offset) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
export function renderAll() { ui.classes(); ui.attendance(); ui.students(); ui.statistics(); }
