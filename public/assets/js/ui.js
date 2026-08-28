import { state } from './state.js';
import { PERIODS, attendanceKey, countsForStudent, attendanceRate, isRisk, displayName } from './logic.js';

const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
};

function monthDays(month) {
    const [year, monthNumber] = String(month).split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dayLabel(date) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'short', day: '2-digit', timeZone: 'UTC'
    });
}

export const ui = {
    toast(message, error = false) {
        const el = document.querySelector('#toast');
        if (!el) return;
        el.textContent = String(message ?? '');
        el.className = `toast show${error ? ' error-toast' : ''}`;
        clearTimeout(el._timer);
        el._timer = setTimeout(() => { el.className = 'toast'; }, 2800);
    },

    setLoading(loading) {
        document.querySelectorAll('button').forEach((button) => {
            if (button.dataset.keepEnabled === 'true') return;
            button.toggleAttribute('aria-busy', !!loading);
        });
    },

    classes() {
        const select = document.querySelector('#classSelect');
        if (!select) return;
        select.innerHTML = '';
        if (!state.classes.length) {
            const option = document.createElement('option');
            option.textContent = 'Aucune classe';
            option.disabled = true;
            option.selected = true;
            select.appendChild(option);
            return;
        }
        for (const cls of state.classes) {
            const option = document.createElement('option');
            option.value = String(cls.id);
            option.textContent = String(cls.name);
            select.appendChild(option);
        }
        select.value = String(state.classId ?? state.classes[0].id);
    },

    attendance() {
        const head = document.querySelector('#attendanceHead');
        const body = document.querySelector('#attendanceBody');
        if (!head || !body) return;

        const days = Array.from({ length: monthDays(state.month) }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            const date = `${state.month}-${day}`;
            return { date, label: dayLabel(date) };
        });
        const map = new Map(state.attendance.map((row) => [
            attendanceKey(row.student_id, row.attendance_date, Number(row.period)), row.status
        ]));

        head.innerHTML = `<tr><th class="sticky student-col" rowspan="2">Élève</th>${days.map((day) => `<th colspan="8" class="day-group">${esc(day.label)}<small>${esc(day.date)}</small></th>`).join('')}</tr><tr>${days.map(() => PERIODS.map((period) => `<th class="period-head"><span>${esc(period)}</span></th>`).join('')).join('')}</tr>`;
        body.innerHTML = '';

        const search = state.search.trim().toLowerCase();
        const filtered = state.students.filter((student) => {
            const name = displayName(student).toLowerCase();
            if (search && !name.includes(search)) return false;
            if (state.filter === 'risk' && !isRisk(student.id, state.attendance)) return false;
            if (state.filter === 'committed' && countsForStudent(student.id, state.attendance).absent > 0) return false;
            return true;
        });

        for (const [index, student] of filtered.entries()) {
            const row = document.createElement('tr');
            const counts = countsForStudent(student.id, state.attendance);
            const name = document.createElement('th');
            name.className = 'sticky student-col';
            name.innerHTML = `<span>${index + 1}. ${esc(displayName(student))}</span><small>${counts.absent} absence(s)</small>`;
            row.appendChild(name);

            for (const day of days) {
                for (let period = 1; period <= 8; period += 1) {
                    const cell = document.createElement('td');
                    const status = map.get(attendanceKey(student.id, day.date, period)) || '';
                    cell.className = `attendance-cell ${status}`;
                    cell.dataset.student = String(student.id);
                    cell.dataset.date = day.date;
                    cell.dataset.period = String(period);
                    cell.dataset.status = status;
                    cell.textContent = status === 'present' ? '✓' : status === 'absent' ? '✕' : status === 'late' ? 'L' : status === 'excused' ? 'E' : '·';
                    cell.title = `${displayName(student)} · ${day.date} · ${PERIODS[period - 1]} · ${status || 'non marqué'}`;
                    row.appendChild(cell);
                }
            }
            body.appendChild(row);
        }

        if (!filtered.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 1 + days.length * 8;
            td.className = 'empty-state';
            td.textContent = 'Aucun élève ne correspond aux filtres.';
            tr.appendChild(td);
            body.appendChild(tr);
        }
        this.stats();
    },

    students() {
        const box = document.querySelector('#studentsList');
        const count = document.querySelector('#studentCount');
        if (!box) return;
        if (count) count.textContent = `${state.students.length} élève(s)`;
        box.innerHTML = '';
        for (const student of state.students) {
            const item = document.createElement('article');
            item.className = 'student-card';
            item.innerHTML = `<div><strong>${esc(displayName(student))}</strong><small>${esc(student.student_number || 'Sans numéro')}</small></div><button class="btn danger small" data-delete-student="${student.id}" type="button">Désactiver</button>`;
            box.appendChild(item);
        }
    },

    stats() {
        let present = 0;
        let absent = 0;
        let other = 0;
        for (const row of state.attendance) {
            if (row.status === 'present') present += 1;
            else if (row.status === 'absent') absent += 1;
            else other += 1;
        }
        const total = present + absent + other;
        document.querySelector('#statPresent').textContent = String(present);
        document.querySelector('#statAbsent').textContent = String(absent);
        document.querySelector('#statOther').textContent = String(other);
        document.querySelector('#statRate').textContent = `${attendanceRate(present, total)}%`;
    },

    statistics() {
        const box = document.querySelector('#statisticsGrid');
        if (!box) return;
        box.innerHTML = '';
        for (const student of state.students) {
            const counts = countsForStudent(student.id, state.attendance);
            const total = counts.present + counts.absent + counts.other;
            const card = document.createElement('article');
            card.className = `stat-card ${counts.absent >= 8 ? 'risk' : ''}`;
            card.innerHTML = `<strong>${esc(displayName(student))}</strong><span>${counts.absent} absence(s)</span><span>${counts.present} présence(s)</span><span>${counts.other} autre(s)</span><b>${attendanceRate(counts.present, total)}%</b>`;
            box.appendChild(card);
        }
    },
};

export function renderAll() {
    ui.classes();
    ui.attendance();
    ui.students();
    ui.statistics();
}
