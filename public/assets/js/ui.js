import { state } from './state.js';
import { PERIODS, attendanceKey, countsForStudent, attendanceRate, isRisk, displayName } from './logic.js';
import { t, currentLanguage } from './i18n.js';

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
            item.innerHTML = `<div><strong>${esc(displayName(student))}</strong><small>${esc(student.massar_code || 'Sans Massar')} · ${esc(student.student_number || 'Sans numéro')}</small></div><div class="dialog-actions">${state.user?.role === 'admin' ? '<button class="btn small" data-transfer-student="' + esc(student.id) + '" type="button">Transférer</button>' : ''}<button class="btn small" data-edit-student="${student.id}" type="button">Modifier</button><button class="btn danger small" data-delete-student="${student.id}" type="button">Désactiver</button></div>`;
            box.appendChild(item);
        }
    },

    adminDashboard() {
        const data = state.adminDashboard;
        if (!data) return;
        const summary = data.summary || {};
        const pulse = document.querySelector('#dashboardPulse');
        if (pulse) {
            const cards = [
                [t('school'), [[t('class_count'), Number(summary.active_classes || 0)], [t('student_count'), Number(summary.active_students || 0)]]],
                [t('teacher_status'), [[t('total_teachers'), Number(summary.active_teachers || 0)], [t('online'), Number(summary.online_teachers || 0)]]],
                [t('today_records'), [[t('records'), Number(summary.today_records || 0)], [t('presence_rate'), formatPct(summary.today_presence_rate)]]],
                [t('today_records'), [[t('present'), Number(summary.today_present || 0)], [t('absent'), Number(summary.today_absent || 0)], [t('late'), Number(summary.today_late || 0)], [t('excused'), Number(summary.today_excused || 0)]]],
            ];
            pulse.innerHTML = cards.map(([title, items]) => '<article class="dashboard-metric"><span>' + esc(title) + '</span>' + items.map(([label, value]) => '<div><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></div>').join('') + '</article>').join('');
        }
        const date = document.querySelector('#dashboardDate');
        if (date) date.textContent = String(data.date || '—');
        const noRecords = Array.isArray(data.classes_without_today_records) ? data.classes_without_today_records : [];
        const attentionStudents = Array.isArray(data.attention_students) ? data.attention_students : [];
        const alerts = [];
        if (noRecords.length) alerts.push('<div class="dashboard-alert warning"><strong>' + esc(t('no_records_today')) + '</strong><span>' + noRecords.slice(0, 6).map((item) => esc(classLabel(item))).join(' · ') + (noRecords.length > 6 ? ' +' + (noRecords.length - 6) : '') + '</span></div>');
        if (attentionStudents.length) alerts.push('<div class="dashboard-alert danger"><strong>' + esc(t('attention_students')) + '</strong><span>' + attentionStudents.length + ' · ' + esc(t('absence_threshold')) + ' ' + (data.absence_alert_threshold || 0) + '</span></div>');
        if (Number(summary.unverified_teachers || 0)) alerts.push('<div class="dashboard-alert warning"><strong>' + esc(t('not_verified')) + '</strong><span>' + Number(summary.unverified_teachers) + '</span></div>');
        if (Number(summary.locked_teachers || 0)) alerts.push('<div class="dashboard-alert danger"><strong>' + esc(t('locked_accounts')) + '</strong><span>' + Number(summary.locked_teachers) + '</span></div>');
        document.querySelector('#dashboardAlerts').innerHTML = alerts.join('') || '<div class="empty-inline">' + esc(t('no_alerts')) + '</div>';
        document.querySelector('#dashboardAlertCount').textContent = String(alerts.length);
        const teacherBox = document.querySelector('#dashboardTeachers');
        if (teacherBox) {
            const rows = [[t('total_teachers'), Number(summary.active_teachers || 0)], [t('online'), Number(summary.online_teachers || 0)], [t('not_verified'), Number(summary.unverified_teachers || 0)], [t('locked_accounts'), Number(summary.locked_teachers || 0)]];
            teacherBox.innerHTML = rows.map(([label, value]) => '<div class="dashboard-row"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join('');
        }
        const classes = Array.isArray(data.class_stats) ? data.class_stats : [];
        const branches = new Map();
        for (const row of classes) {
            const key = String(row.branch || '—');
            if (!branches.has(key)) branches.set(key, { branch: key, classes: 0, students: 0, records: 0, present: 0, absent: 0, late: 0, excused: 0 });
            const item = branches.get(key);
            item.classes += 1; item.students += Number(row.student_count || 0); item.records += Number(row.today_records || 0);
            item.present += Number(row.present_count || 0); item.absent += Number(row.absent_count || 0); item.late += Number(row.late_count || 0); item.excused += Number(row.excused_count || 0);
        }
        const branchGrid = document.querySelector('#dashboardBranchGrid');
        if (branchGrid) {
            branchGrid.innerHTML = Array.from(branches.values()).map((branch) => {
                const total = branch.present + branch.absent + branch.late + branch.excused;
                const rate = total ? (branch.present / total) * 100 : 0;
                return '<article class="branch-card"><div class="branch-card-head"><strong>' + esc(branch.branch) + '</strong><span>' + branch.classes + ' ' + esc(t('class_count')) + '</span></div><div class="branch-card-grid">' + metric(t('student_count'), branch.students) + metric(t('records'), branch.records) + metric(t('present'), branch.present) + metric(t('absent'), branch.absent) + metric(t('late'), branch.late) + metric(t('presence_rate'), formatPct(rate)) + '</div></article>';
            }).join('') || '<div class="empty-state">' + esc(t('no_alerts')) + '</div>';
        }
        const classTable = document.querySelector('#dashboardClassTable');
        if (classTable) {
            classTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('branch')) + '</th><th>' + esc(t('class_name')) + '</th><th>' + esc(t('student_count')) + '</th><th>' + esc(t('records')) + '</th><th>' + esc(t('present')) + '</th><th>' + esc(t('absent')) + '</th><th>' + esc(t('late')) + '</th><th>' + esc(t('excused')) + '</th><th>' + esc(t('presence_rate')) + '</th></tr>';
            classTable.querySelector('tbody').innerHTML = classes.map((row) => {
                const total = Number(row.present_count || 0) + Number(row.absent_count || 0) + Number(row.late_count || 0) + Number(row.excused_count || 0);
                const rate = total ? (Number(row.present_count || 0) / total) * 100 : 0;
                return '<tr><td>' + esc(row.branch || '—') + '</td><td>' + esc(classLabel(row)) + '</td><td>' + Number(row.student_count || 0) + '</td><td>' + Number(row.today_records || 0) + '</td><td>' + Number(row.present_count || 0) + '</td><td>' + Number(row.absent_count || 0) + '</td><td>' + Number(row.late_count || 0) + '</td><td>' + Number(row.excused_count || 0) + '</td><td>' + esc(formatPct(rate)) + '</td></tr>';
            }).join('') || '<tr><td colspan="9" class="empty-state">' + esc(t('no_alerts')) + '</td></tr>';
        }
        const studentTable = document.querySelector('#dashboardStudentTable');
        if (studentTable) {
            studentTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('student')) + '</th><th>' + esc(t('class_name')) + '</th><th>' + esc(t('absence_count')) + '</th><th>' + esc(t('late_count')) + '</th><th>' + esc(t('review')) + '</th></tr>';
            studentTable.querySelector('tbody').innerHTML = attentionStudents.map((row) => '<tr><td>' + esc([row.first_name, row.last_name].filter(Boolean).join(' ')) + '</td><td>' + esc(classLabel(row)) + '</td><td>' + Number(row.absent_count || 0) + '</td><td>' + Number(row.late_count || 0) + '</td><td>' + esc(t('review')) + '</td></tr>').join('') || '<tr><td colspan="5" class="empty-state">' + esc(t('no_alerts')) + '</td></tr>';
        }
        const auditTable = document.querySelector('#dashboardAuditTable');
        if (auditTable) {
            const audit = Array.isArray(data.recent_audit) ? data.recent_audit : [];
            auditTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('date')) + '</th><th>' + esc(t('activity')) + '</th><th>' + esc(t('user')) + '</th><th>' + esc(t('entity')) + '</th></tr>';
            auditTable.querySelector('tbody').innerHTML = audit.map((row) => '<tr><td>' + esc(row.created_at || '—') + '</td><td>' + esc(row.action || '—') + '</td><td>' + esc(row.full_name || row.username || '—') + '</td><td>' + esc(row.entity_type || '—') + ' #' + esc(row.entity_id ?? '—') + '</td></tr>').join('') || '<tr><td colspan="4" class="empty-state">' + esc(t('no_alerts')) + '</td></tr>';
        }
    },
    teachers() {
        const box = document.querySelector('#teachersList');
        if (!box) return;

        const subjectFilter = document.querySelector('#teacherSubjectFilter');
        const classFilter = document.querySelector('#teacherClassFilter');
        const statusFilter = document.querySelector('#teacherStatusFilter');
        const searchInput = document.querySelector('#teacherSearch');

        const currentSubject = subjectFilter?.value || 'all';
        const currentClass = classFilter?.value || 'all';

        if (subjectFilter) {
            subjectFilter.innerHTML = '<option value="all">' + esc(t('all_subjects')) + '</option>'
                + state.subjects.map((subject) =>
                    '<option value="' + esc(subject.id) + '">' + esc(subjectLabel(subject)) + '</option>'
                ).join('');
            subjectFilter.value = state.subjects.some((item) => String(item.id) === currentSubject) ? currentSubject : 'all';
        }

        if (classFilter) {
            const classes = state.adminClasses
                .filter((item) => Number(item.is_active) === 1)
                .slice()
                .sort((a, b) => String(a.academic_year_name || '').localeCompare(String(b.academic_year_name || '')) || String(a.name).localeCompare(String(b.name)));
            classFilter.innerHTML = '<option value="all">' + esc(t('all_classes')) + '</option>'
                + classes.map((cls) =>
                    '<option value="' + esc(cls.id) + '">' + esc(classLabel(cls)) + '</option>'
                ).join('');
            classFilter.value = classes.some((item) => String(item.id) === currentClass) ? currentClass : 'all';
        }

        const teacherSelect = document.querySelector('#teachingTeacherId');
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="">—</option>' + state.teachers.map((teacher) =>
                '<option value="' + esc(teacher.id) + '">' + esc(teacher.full_name) + ' · ' + esc(teacher.employee_id || teacher.username || '') + '</option>'
            ).join('');
        }

        const subjectSelect = document.querySelector('#teachingSubjectId');
        if (subjectSelect) {
            const activeSubjects = state.subjects.filter((subject) => Number(subject.is_active) === 1);
            subjectSelect.innerHTML = '<option value="">—</option>' + activeSubjects.map((subject) =>
                '<option value="' + esc(subject.id) + '">' + esc(subjectLabel(subject)) + ' · ' + esc(subject.code) + '</option>'
            ).join('');
        }

        const teachingClassSelect = document.querySelector('#teachingClassId');
        if (teachingClassSelect) {
            const activeClasses = state.adminClasses.filter((item) => Number(item.is_active) === 1);
            teachingClassSelect.innerHTML = '<option value="">—</option>' + activeClasses.map((cls) =>
                '<option value="' + esc(cls.id) + '">' + esc(classLabel(cls)) + '</option>'
            ).join('');
        }

        const allTeachers = Array.isArray(state.teachers) ? state.teachers : [];
        const onlineCount = allTeachers.filter((teacher) => Number(teacher.is_online) === 1).length;
        const unverifiedCount = allTeachers.filter((teacher) => Number(teacher.phone_verified) !== 1).length;
        const inactiveCount = allTeachers.filter((teacher) => Number(teacher.is_active) !== 1).length;
        document.querySelector('#teacherTotal')?.replaceChildren(document.createTextNode(String(allTeachers.length)));
        document.querySelector('#teacherOnline')?.replaceChildren(document.createTextNode(String(onlineCount)));
        document.querySelector('#teacherUnverified')?.replaceChildren(document.createTextNode(String(unverifiedCount)));
        document.querySelector('#teacherInactive')?.replaceChildren(document.createTextNode(String(inactiveCount)));

        const search = String(searchInput?.value || '').trim().toLowerCase();
        const status = statusFilter?.value || 'all';
        const teachingsByTeacher = new Map();
        for (const teaching of (Array.isArray(state.teachings) ? state.teachings : [])) {
            const id = Number(teaching.teacher_id);
            if (!teachingsByTeacher.has(id)) teachingsByTeacher.set(id, []);
            teachingsByTeacher.get(id).push(teaching);
        }

        const filtered = allTeachers.filter((teacher) => {
            const teachings = teachingsByTeacher.get(Number(teacher.id)) || [];
            const haystack = [
                teacher.full_name,
                teacher.employee_id || teacher.username,
                teacher.phone || ''
            ].join(' ').toLowerCase();

            if (search && !haystack.includes(search)) return false;
            if (status === 'online' && Number(teacher.is_online) !== 1) return false;
            if (status === 'offline' && Number(teacher.is_online) === 1) return false;
            if (status === 'active' && Number(teacher.is_active) !== 1) return false;
            if (status === 'inactive' && Number(teacher.is_active) === 1) return false;
            if (currentSubject !== 'all' && !teachings.some((item) => String(item.subject_id) === currentSubject)) return false;
            if (currentClass !== 'all' && !teachings.some((item) => String(item.class_id) === currentClass)) return false;
            return true;
        });

        box.innerHTML = filtered.map((teacher) => {
            const teachings = teachingsByTeacher.get(Number(teacher.id)) || [];
            const statusClass = Number(teacher.is_online) === 1 ? 'online' : 'offline';
            const statusLabel = Number(teacher.is_online) === 1 ? t('online') : t('offline');
            const activation = Number(teacher.phone_verified) === 1 ? t('verified') : t('not_verified');

            const assignmentMarkup = teachings.length
                ? teachings.map((item) =>
                    '<div class="teaching-chip">'
                    + '<span><strong>' + esc(subjectLabel(item)) + '</strong><small>' + esc(classLabel(item)) + '</small></span>'
                    + '<button class="btn small danger" type="button" data-unassign-teaching="' + esc(item.id) + '" aria-label="' + esc(t('remove')) + '">×</button>'
                    + '</div>'
                ).join('')
                : '<div class="empty-inline">' + esc(t('no_assignments')) + '</div>';

            return '<article class="teacher-card">'
                + '<div class="teacher-card-head">'
                + '<div class="teacher-avatar">' + esc(initials(teacher.full_name)) + '</div>'
                + '<div class="teacher-identity">'
                + '<strong>' + esc(teacher.full_name) + '</strong>'
                + '<small>' + esc(teacher.employee_id || teacher.username || t('no_employee_id')) + '</small>'
                + '</div>'
                + '<span class="presence-badge ' + statusClass + '"><i aria-hidden="true"></i>' + esc(statusLabel) + '</span>'
                + '</div>'
                + '<div class="teacher-meta">'
                + '<span>' + esc(t('phone')) + ': ' + esc(teacher.phone || t('no_phone')) + '</span>'
                + '<span>' + esc(t('verified')) + ': ' + esc(activation) + '</span>'
                + '<span>' + esc(t('last_activity')) + ': ' + esc(teacher.last_seen_at || '—') + '</span>'
                + '</div>'
                + '<div class="teacher-section"><span class="teacher-section-title">' + esc(t('subjects')) + ' / ' + esc(t('classes')) + '</span>'
                + '<div class="teaching-chips">' + assignmentMarkup + '</div></div>'
                + '<div class="teacher-actions">'
                + '<button class="btn small" type="button" data-edit-teacher="' + esc(teacher.id) + '">' + esc(t('manage')) + '</button>'
                + '<button class="btn small primary" type="button" data-assign-teacher="' + esc(teacher.id) + '">' + esc(t('assign')) + '</button>'
                + '</div>'
                + '</article>';
        }).join('');

        if (!filtered.length) {
            box.innerHTML = '<div class="empty-state">' + esc(t('no_teachers')) + '</div>';
        }
    },

    admin() {
        const classesTable = document.querySelector('#adminClassesTable');
        if (classesTable) {
            classesTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('class')) + '</th><th>' + esc(t('level')) + '</th><th>' + esc(t('branch')) + '</th><th>' + esc(t('academic_year')) + '</th><th>' + esc(t('active')) + '</th><th>' + esc(t('actions')) + '</th></tr>';
            classesTable.querySelector('tbody').innerHTML = state.adminClasses.map((cls) => {
                const active = Number(cls.is_active) === 1;
                return '<tr>'
                    + '<td>' + esc(cls.name) + '</td>'
                    + '<td>' + esc(cls.level || '—') + '</td>'
                    + '<td>' + esc(cls.branch || '—') + '</td>'
                    + '<td>' + esc(cls.academic_year_name || '—') + '</td>'
                    + '<td>' + (active ? t('yes') : t('no')) + '</td>'
                    + '<td>'
                    + '<button class="btn small" data-edit-class="' + esc(cls.id) + '" type="button">' + esc(t('edit')) + '</button> '
                    + '<button class="btn danger small" data-toggle-class="' + esc(cls.id) + '" data-active="' + (active ? '1' : '0') + '" type="button">'
                    + (active ? t('deactivate') : t('activate'))
                    + '</button>'
                    + '</td>'
                    + '</tr>';
            }).join('') || '<tr><td colspan="6" class="empty-state">' + esc(t('empty_classes')) + '</td></tr>';
        }

        const usersTable = document.querySelector('#usersTable');
        if (usersTable) {
            usersTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('username')) + '</th><th>' + esc(t('full_name')) + '</th><th>' + esc(t('role')) + '</th><th>' + esc(t('active')) + '</th><th>' + esc(t('actions')) + '</th></tr>';
            usersTable.querySelector('tbody').innerHTML = state.users.map((user) => {
                const active = Number(user.is_active) === 1;
                return '<tr>'
                    + '<td>' + esc(user.username) + '</td>'
                    + '<td>' + esc(user.full_name) + '</td>'
                    + '<td>' + esc(roleLabel(user.role)) + '</td>'
                    + '<td>' + (active ? 'Oui' : 'Non') + '</td>'
                    + '<td>'
                    + '<button class="btn small" data-edit-user="' + esc(user.id) + '" type="button">Modifier</button> '
                    + '<button class="btn small" data-reset-user="' + esc(user.id) + '" type="button">' + esc(t('password')) + '</button> '
                    + '<button class="btn small" data-unlock-user="' + esc(user.id) + '" type="button">' + esc(t('unlock')) + '</button> '
                    + '<button class="btn danger small" data-toggle-user="' + esc(user.id) + '" data-active="' + (active ? '1' : '0') + '" type="button">'
                    + (active ? t('deactivate') : t('activate'))
                    + '</button>'
                    + '</td>'
                    + '</tr>';
            }).join('') || '<tr><td colspan="5" class="empty-state">' + esc(t('empty_users')) + '</td></tr>';
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
            assignmentsTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('teacher')) + '</th><th>' + esc(t('active')) + '</th><th>' + esc(t('since')) + '</th><th>' + esc(t('actions')) + '</th></tr>';
            assignmentsTable.querySelector('tbody').innerHTML = state.assignments.map((item) =>
                '<tr><td>' + esc(item.full_name) + ' (' + esc(item.username) + ')</td>'
                + '<td>' + (Number(item.is_active) === 1 ? t('yes') : t('no')) + '</td>'
                + '<td>' + esc(item.assigned_at) + '</td>'
                + '<td><button class="btn danger small" data-unassign-teacher="' + esc(item.id) + '" type="button">' + esc(t('remove')) + '</button></td></tr>'
            ).join('') || '<tr><td colspan="4" class="empty-state">Aucune affectation pour cette classe.</td></tr>';
        }

        const academicYearsTable = document.querySelector('#academicYearsTable');
        if (academicYearsTable) {
            academicYearsTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('name')) + '</th><th>' + esc(t('start')) + '</th><th>' + esc(t('end')) + '</th><th>' + esc(t('active')) + '</th><th>' + esc(t('actions')) + '</th></tr>';
            academicYearsTable.querySelector('tbody').innerHTML = state.academicYears.map((year) => {
                const active = Number(year.is_active) === 1;
                return '<tr><td>' + esc(year.name) + '</td>'
                    + '<td>' + esc(year.starts_on) + '</td>'
                    + '<td>' + esc(year.ends_on) + '</td>'
                    + '<td>' + (active ? 'Oui' : 'Non') + '</td>'
                    + '<td><button class="btn small" data-activate-year="' + esc(year.id) + '" type="button" ' + (active ? 'disabled' : '') + '>' + esc(t('activate')) + '</button></td></tr>';
            }).join('') || '<tr><td colspan="5" class="empty-state">' + esc(t('empty_years')) + '</td></tr>';
        }

        const importsTable = document.querySelector('#importsTable');
        if (importsTable) {
            importsTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('file')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('rows')) + '</th><th>' + esc(t('valid')) + '</th><th>' + esc(t('errors')) + '</th><th>' + esc(t('actions')) + '</th></tr>';
            importsTable.querySelector('tbody').innerHTML = state.imports.map((batch) =>
                '<tr><td>' + esc(batch.original_filename) + '</td>'
                + '<td>' + esc(batch.status) + '</td>'
                + '<td>' + Number(batch.total_rows) + '</td>'
                + '<td>' + Number(batch.valid_rows) + '</td>'
                + '<td>' + Number(batch.error_rows) + '</td>'
                + '<td>'
                + '<button class="btn small" data-edit-import="' + esc(batch.id) + '" type="button">' + esc(t('correct')) + '</button> '
                + '<button class="btn small" data-revalidate-import="' + esc(batch.id) + '" type="button">' + esc(t('revalidate')) + '</button> '
                + '<button class="btn success small" data-run-import="' + esc(batch.id) + '" type="button" '
                + (batch.status === 'validated' ? '' : 'disabled')
                + '>' + esc(t('import_action')) + '</button>'
                + '</td></tr>'
            ).join('') || '<tr><td colspan="6" class="empty-state">Aucun import pour cette classe.</td></tr>';
        }

        const auditTable = document.querySelector('#auditTable');
        if (auditTable) {
            auditTable.querySelector('thead').innerHTML = '<tr><th>' + esc(t('date')) + '</th><th>' + esc(t('activity')) + '</th><th>' + esc(t('user')) + '</th><th>' + esc(t('entity')) + '</th></tr>';
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
            head.innerHTML = '<tr><th>Élève</th><th>Présences</th><th>Absences</th><th>Retards</th><th>Excusés</th><th>Jours enregistrés</th><th>Historique</th></tr>';
            const rows = Array.isArray(data?.students) ? data.students : [];
            body.innerHTML = rows.map((row) =>
                '<tr><td>' + esc((String(row.first_name || '') + ' ' + String(row.last_name || '')).trim()) + '</td>'
                + '<td>' + Number(row.present_count) + '</td>'
                + '<td>' + Number(row.absent_count) + '</td>'
                + '<td>' + Number(row.late_count) + '</td>'
                + '<td>' + Number(row.excused_count) + '</td>'
                + '<td>' + Number(row.recorded_days) + '</td>'
                + '<td><button class="btn small" type="button" data-student-history="' + esc(row.id) + '">Voir</button></td></tr>'
            ).join('') || '<tr><td colspan="7" class="empty-state">Aucun enregistrement.</td></tr>';
            return;
        }

        head.innerHTML = '<tr><th>Date</th><th>Enregistrements</th><th>Présences</th><th>Absences</th><th>Retards</th><th>Excusés</th><th>Détails</th></tr>';
        const rows = Array.isArray(data?.days) ? data.days : [];
        body.innerHTML = rows.map((row) =>
            '<tr><td>' + esc(row.attendance_date) + '</td>'
            + '<td>' + Number(row.recorded_count) + '</td>'
            + '<td>' + Number(row.present_count) + '</td>'
            + '<td>' + Number(row.absent_count) + '</td>'
            + '<td>' + Number(row.late_count) + '</td>'
            + '<td>' + Number(row.excused_count) + '</td>'
            + '<td><button class="btn small" type="button" data-archive-day="' + esc(row.attendance_date) + '">Ouvrir</button></td></tr>'
        ).join('') || '<tr><td colspan="7" class="empty-state">Aucun enregistrement.</td></tr>';
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

function roleLabel(role) {
    const key = role === 'admin' ? 'role_admin' : role === 'teacher' ? 'role_teacher' : 'role_counselor';
    return t(key);
}

function formatPct(value) { return String(Number(value || 0).toFixed(1)) + '%'; }

function metric(label, value) { return '<div><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></div>'; }

function subjectLabel(subject) {
    const lang = currentLanguage();
    return subject?.['name_' + (lang === 'ar' ? 'ar' : lang === 'en' ? 'en' : 'fr')] || subject?.name_fr || subject?.subject_name_fr || subject?.code || '—';
}

function classLabel(item) {
    const pieces = [item?.class_level || item?.level, item?.class_branch || item?.branch, item?.class_name || item?.name, item?.academic_year_name];
    return pieces.filter(Boolean).join(' · ');
}

function initials(name) {
    return String(name || 'T').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'T';
}

export function renderAll() {
    ui.classes();
    ui.attendance();
    ui.students();
    ui.statistics();
    ui.teachers();
    ui.adminDashboard();
    ui.admin();
    if (state.archive) ui.archive(state.archive, state.archiveView || 'days');
}
