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
            item.innerHTML = `<div><strong>${esc(displayName(student))}</strong><small>${esc(student.massar_code || 'Sans Massar')} · ${esc(student.student_number || 'Sans numéro')}</small></div><div class="dialog-actions"><button class="btn small" data-edit-student="${student.id}" type="button">Modifier</button><button class="btn danger small" data-delete-student="${student.id}" type="button">Désactiver</button></div>`;
            box.appendChild(item);
        }
    },

    admin() {
        const usersTable = document.querySelector('#usersTable');
        if (usersTable) {
            usersTable.querySelector('thead').innerHTML = '<tr><th>Utilisateur</th><th>Nom</th><th>Rôle</th><th>Actif</th><th>Actions</th></tr>';
            usersTable.querySelector('tbody').innerHTML = state.users.map((user) => {
                const active = Number(user.is_active) === 1;
                return '<tr>'
                    + '<td>' + esc(user.username) + '</td>'
                    + '<td>' + esc(user.full_name) + '</td>'
                    + '<td>' + esc(user.role) + '</td>'
                    + '<td>' + (active ? 'Oui' : 'Non') + '</td>'
                    + '<td>'
                    + '<button class="btn small" data-unlock-user="' + esc(user.id) + '" type="button">Déverrouiller</button> '
                    + '<button class="btn danger small" data-toggle-user="' + esc(user.id) + '" data-active="' + (active ? '1' : '0') + '" type="button">'
                    + (active ? 'Désactiver' : 'Activer')
                    + '</button>'
                    + '</td>'
                    + '</tr>';
            }).join('') || '<tr><td colspan="5" class="empty-state">Aucun utilisateur.</td></tr>';
        }

        const teacherSelect = document.querySelector('#assignmentTeacherInput');
        if (teacherSelect) {
            const teachers = state.users.filter((user) => user.role === 'teacher' && Number(user.is_active) === 1);
            teacherSelect.innerHTML = teachers.map((user) =>
                '<option value="' + esc(user.id) + '">' + esc(user.full_name) + ' (' + esc(user.username) + ')</option>'
            ).join('');
        }

        const classSelect = document.querySelector('#assignmentClassInput');
        if (classSelect) {
            classSelect.innerHTML = state.classes.map((cls) =>
                '<option value="' + esc(cls.id) + '">' + esc(cls.name) + '</option>'
            ).join('');
        }

        const assignmentsTable = document.querySelector('#assignmentsTable');
        if (assignmentsTable) {
            assignmentsTable.querySelector('thead').innerHTML = '<tr><th>Enseignant</th><th>Actif</th><th>Depuis</th><th>Action</th></tr>';
            assignmentsTable.querySelector('tbody').innerHTML = state.assignments.map((item) =>
                '<tr><td>' + esc(item.full_name) + ' (' + esc(item.username) + ')</td>'
                + '<td>' + (Number(item.is_active) === 1 ? 'Oui' : 'Non') + '</td>'
                + '<td>' + esc(item.assigned_at) + '</td>'
                + '<td><button class="btn danger small" data-unassign-teacher="' + esc(item.id) + '" type="button">Retirer</button></td></tr>'
            ).join('') || '<tr><td colspan="4" class="empty-state">Aucune affectation pour cette classe.</td></tr>';
        }

        const academicYearsTable = document.querySelector('#academicYearsTable');
        if (academicYearsTable) {
            academicYearsTable.querySelector('thead').innerHTML = '<tr><th>Nom</th><th>Début</th><th>Fin</th><th>Active</th><th>Action</th></tr>';
            academicYearsTable.querySelector('tbody').innerHTML = state.academicYears.map((year) => {
                const active = Number(year.is_active) === 1;
                return '<tr><td>' + esc(year.name) + '</td>'
                    + '<td>' + esc(year.starts_on) + '</td>'
                    + '<td>' + esc(year.ends_on) + '</td>'
                    + '<td>' + (active ? 'Oui' : 'Non') + '</td>'
                    + '<td><button class="btn small" data-activate-year="' + esc(year.id) + '" type="button" ' + (active ? 'disabled' : '') + '>Activer</button></td></tr>';
            }).join('') || '<tr><td colspan="5" class="empty-state">Aucune année scolaire.</td></tr>';
        }

        const importsTable = document.querySelector('#importsTable');
        if (importsTable) {
            importsTable.querySelector('thead').innerHTML = '<tr><th>Fichier</th><th>État</th><th>Lignes</th><th>Valides</th><th>Erreurs</th><th>Actions</th></tr>';
            importsTable.querySelector('tbody').innerHTML = state.imports.map((batch) =>
                '<tr><td>' + esc(batch.original_filename) + '</td>'
                + '<td>' + esc(batch.status) + '</td>'
                + '<td>' + Number(batch.total_rows) + '</td>'
                + '<td>' + Number(batch.valid_rows) + '</td>'
                + '<td>' + Number(batch.error_rows) + '</td>'
                + '<td>'
                + '<button class="btn small" data-edit-import="' + esc(batch.id) + '" type="button">Corriger</button> '
                + '<button class="btn small" data-revalidate-import="' + esc(batch.id) + '" type="button">Revalider</button> '
                + '<button class="btn success small" data-run-import="' + esc(batch.id) + '" type="button" '
                + (batch.status === 'validated' ? '' : 'disabled')
                + '>Importer</button>'
                + '</td></tr>'
            ).join('') || '<tr><td colspan="6" class="empty-state">Aucun import pour cette classe.</td></tr>';
        }

        const auditTable = document.querySelector('#auditTable');
        if (auditTable) {
            auditTable.querySelector('thead').innerHTML = '<tr><th>Date</th><th>Action</th><th>Utilisateur</th><th>Entité</th></tr>';
            const items = Array.isArray(state.auditItems) ? state.auditItems : [];
            auditTable.querySelector('tbody').innerHTML = items.map((item) =>
                '<tr><td>' + esc(item.created_at) + '</td>'
                + '<td>' + esc(item.action) + '</td>'
                + '<td>' + esc(item.full_name || item.username || '—') + '</td>'
                + '<td>' + esc(item.entity_type || '—') + ' #' + esc(item.entity_id ?? '—') + '</td></tr>'
            ).join('') || '<tr><td colspan="4" class="empty-state">Aucune activité.</td></tr>';
        }
    },

    archive(data, view = 'days') {
        const table = document.querySelector('#archiveTable');
        if (!table) return;

        const head = table.querySelector('thead');
        const body = table.querySelector('tbody');

        if (view === 'month') {
            head.innerHTML = '<tr><th>Élève</th><th>Présences</th><th>Absences</th><th>Retards</th><th>Excusés</th><th>Jours enregistrés</th></tr>';
            const rows = Array.isArray(data?.students) ? data.students : [];
            body.innerHTML = rows.map((row) =>
                '<tr><td>' + esc((String(row.first_name || '') + ' ' + String(row.last_name || '')).trim()) + '</td>'
                + '<td>' + Number(row.present_count) + '</td>'
                + '<td>' + Number(row.absent_count) + '</td>'
                + '<td>' + Number(row.late_count) + '</td>'
                + '<td>' + Number(row.excused_count) + '</td>'
                + '<td>' + Number(row.recorded_days) + '</td></tr>'
            ).join('') || '<tr><td colspan="6" class="empty-state">Aucun enregistrement.</td></tr>';
            return;
        }

        head.innerHTML = '<tr><th>Date</th><th>Enregistrements</th><th>Présences</th><th>Absences</th><th>Retards</th><th>Excusés</th></tr>';
        const rows = Array.isArray(data?.days) ? data.days : [];
        body.innerHTML = rows.map((row) =>
            '<tr><td>' + esc(row.attendance_date) + '</td>'
            + '<td>' + Number(row.recorded_count) + '</td>'
            + '<td>' + Number(row.present_count) + '</td>'
            + '<td>' + Number(row.absent_count) + '</td>'
            + '<td>' + Number(row.late_count) + '</td>'
            + '<td>' + Number(row.excused_count) + '</td></tr>'
        ).join('') || '<tr><td colspan="6" class="empty-state">Aucun enregistrement pour ce mois.</td></tr>';
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
    ui.admin();
    if (state.archive) ui.archive(state.archive, state.archiveView || 'days');
}
