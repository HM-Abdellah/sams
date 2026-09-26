import { state } from './state.js';
import { DAYS, PERIODS, dateFromWeek, attendanceKey, countsForStudent, attendanceRate, isRisk, displayName } from './logic.js';
import { t, currentLanguage } from './i18n.js';

const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
};

function localeForLanguage() { return currentLanguage() === 'ar' ? 'ar-MA' : currentLanguage() === 'en' ? 'en-GB' : 'fr-FR'; }

function formatWeekDay(date) {
    const value = new Date(`${date}T00:00:00Z`);
    return { weekday: value.toLocaleDateString(localeForLanguage(), { weekday: 'short', timeZone: 'UTC' }), date: value.toLocaleDateString(localeForLanguage(), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) };
}

function monthDays(month) {
    const [year, monthNumber] = String(month).split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dayLabel(date) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(localeForLanguage(), { weekday: 'short', day: '2-digit', timeZone: 'UTC' });
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
            option.textContent = t('no_classes');
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
        const mobile = document.querySelector('#attendanceMobileList');
        const table = document.querySelector('#attendanceTable');
        const weekDays = document.querySelector('#weekDays');
        const periods = document.querySelector('#periods');
        const workflow = document.querySelector('#attendanceWorkflow');
        const weeklySignatures = document.querySelector('#weeklyTeacherSignatures');
        if (!mobile || !weekDays || !periods || !table) return;

        const weekStart = state.weekStart;
        const selectedDay = state.selectedDay || dateFromWeek(weekStart, 0);
        const selectedPeriod = Number(state.selectedPeriod || 1);
        const days = DAYS.map((shortName, index) => ({
            shortName,
            date: dateFromWeek(weekStart, index),
            label: formatWeekDay(dateFromWeek(weekStart, index)),
        }));

        weekDays.innerHTML = days.map((day) =>
            '<button class="week-day-btn ' + (day.date === selectedDay ? 'active' : '') + '" type="button" data-select-day="' + esc(day.date) + '" role="tab" aria-selected="' + (day.date === selectedDay ? 'true' : 'false') + '">'
            + '<strong>' + esc(day.label.weekday) + '</strong><small>' + esc(day.label.date) + '</small></button>'
        ).join('');

        periods.innerHTML = PERIODS.map((period, index) =>
            '<button class="period-btn ' + (index + 1 === selectedPeriod ? 'active' : '') + '" type="button" data-select-period="' + (index + 1) + '"><strong>'
            + (index + 1) + '</strong><small>' + esc(period) + '</small></button>'
        ).join('');

        const map = new Map(state.attendance.map((row) => [
            attendanceKey(row.student_id, row.attendance_date, Number(row.period)), row.status
        ]));
        const signoffRows = Array.isArray(state.attendanceSignoffs?.period_signoffs) ? state.attendanceSignoffs.period_signoffs : [];
        const weeklyRows = Array.isArray(state.attendanceSignoffs?.weekly_signatures) ? state.attendanceSignoffs.weekly_signatures : [];
        const currentSignoff = signoffRows.find((row) =>
            String(row.attendance_date) === String(selectedDay) && Number(row.period) === selectedPeriod
        ) || null;
        const signed = currentSignoff?.status === 'signed';
        const needsResign = currentSignoff?.status === 'needs_resign';
        const selectedDayLabel = formatWeekDay(selectedDay);

        if (workflow) {
            const signerName = currentSignoff?.teacher_name || t('not_signed');
            let statusText = t('lesson_not_signed');
            let statusClass = 'pending';
            if (signed) {
                statusText = t('lesson_signed_by') + ' ' + signerName;
                statusClass = 'signed';
            } else if (needsResign) {
                statusText = t('lesson_needs_resign');
                statusClass = 'needs-resign';
            }

            const canReopen = signed && (state.user?.role === 'admin' || Number(currentSignoff?.teacher_id) === Number(state.user?.id));
            const signButton = state.user?.role === 'teacher' && !signed
                ? '<button class="btn primary" type="button" data-sign-period="1">' + esc(needsResign ? t('resign_lesson') : t('sign_lesson')) + '</button>'
                : '';
            const reopenButton = canReopen
                ? '<button class="btn" type="button" data-reopen-period="1">' + esc(t('reopen_correction')) + '</button>'
                : '';

            workflow.innerHTML =
                '<div class="attendance-workflow-head">'
                + '<div><strong>' + esc(selectedDayLabel.weekday + ' ' + selectedDayLabel.date) + ' · ' + esc(t('period')) + ' ' + selectedPeriod + '</strong><small>' + esc(PERIODS[selectedPeriod - 1] || '') + '</small></div>'
                + '<span class="attendance-seal ' + statusClass + '">' + esc(statusText) + '</span></div>'
                + '<div class="attendance-workflow-actions">' + signButton + reopenButton + '</div>'
                + '<p class="attendance-workflow-note">' + esc(signed ? t('lesson_signed_hint') : needsResign ? t('lesson_needs_resign_hint') : t('lesson_sign_hint')) + '</p>';
        }

        const search = state.search.trim().toLowerCase();
        const filtered = state.students.filter((student) => {
            const name = displayName(student).toLowerCase();
            if (search && !name.includes(search)) return false;
            if (state.filter === 'risk' && !isRisk(student.id, state.attendance)) return false;
            if (state.filter === 'committed' && countsForStudent(student.id, state.attendance).absent > 0) return false;
            return true;
        });

        const markButton = (studentId, currentStatus) =>
            '<button class="attendance-mark-btn ' + (currentStatus === 'absent' ? 'absent' : 'present') + '" type="button" data-attendance-toggle="1" data-student="' + esc(studentId) + '" aria-pressed="' + (currentStatus === 'absent' ? 'true' : 'false') + '"' + (signed ? ' disabled' : '') + '>'
            + (currentStatus === 'absent' ? 'X' : '') + '</button>';

        mobile.innerHTML = filtered.map((student, index) => {
            const currentStatus = map.get(attendanceKey(student.id, selectedDay, selectedPeriod)) || '';
            const counts = countsForStudent(student.id, state.attendance);
            return '<article class="attendance-student-card">'
                + '<div class="attendance-student-head"><div><strong>' + (index + 1) + '. ' + esc(displayName(student)) + '</strong><small>' + esc(student.student_number || student.massar_code || t('no_student_number')) + '</small></div><div class="week-counts"><span>' + esc(t('week_absence_short')) + ' ' + counts.absent + '</span></div></div>'
                + '<div class="attendance-mark-row"><span class="attendance-mark-label">' + esc(currentStatus === 'absent' ? t('absent_mark') : t('present_blank')) + '</span>' + markButton(student.id, currentStatus) + '</div>'
                + '</article>';
        }).join('');

        if (!filtered.length) mobile.innerHTML = '<div class="empty-state">' + esc(t('no_students_filter')) + '</div>';

        const head = table.querySelector('thead');
        const body = table.querySelector('tbody');
        head.innerHTML = '<tr><th class="sticky student-col">#</th><th class="sticky second-student-col">' + esc(t('student')) + '</th><th>' + esc(t('current_period')) + '</th><th>' + esc(t('week_absences')) + '</th></tr>';
        body.innerHTML = filtered.map((student, index) => {
            const currentStatus = map.get(attendanceKey(student.id, selectedDay, selectedPeriod)) || '';
            const counts = countsForStudent(student.id, state.attendance);
            return '<tr><td class="sticky student-col">' + (index + 1) + '</td><td class="sticky second-student-col"><strong>' + esc(displayName(student)) + '</strong><small>' + esc(student.student_number || student.massar_code || t('no_student_number')) + '</small></td><td>'
                + markButton(student.id, currentStatus)
                + '</td><td>' + counts.absent + '</td></tr>';
        }).join('');

        if (weeklySignatures) {
            const teachers = Array.isArray(state.attendanceSignoffs?.teachers) ? state.attendanceSignoffs.teachers : [];
            const weeklyMap = new Map(weeklyRows.map((row) => [Number(row.teacher_id), row]));
            const signedCount = teachers.filter((teacher) => weeklyMap.get(Number(teacher.id))?.status === 'signed').length;
            const readyForAdmin = teachers.length > 0 && signedCount === teachers.length;
            const submission = state.attendanceSignoffs?.submission || null;

            weeklySignatures.innerHTML =
                '<div class="weekly-signatures-head"><div><h2>' + esc(t('weekly_certification')) + '</h2><p>' + esc(t('weekly_certification_hint')) + '</p></div>'
                + '<strong>' + signedCount + '/' + teachers.length + '</strong></div>'
                + (submission
                    ? '<div class="register-receipt received"><strong>' + esc(t('register_received')) + '</strong><span>' + esc(t('received_by')) + ': ' + esc(submission.received_by_name || '—') + ' · ' + esc(submission.received_at || '') + '</span></div>'
                    : readyForAdmin
                        ? '<div class="register-receipt ready"><strong>' + esc(t('register_ready')) + '</strong><span>' + esc(t('weekly_certification_hint')) + '</span>' + (state.user?.role === 'admin' ? '<button class="btn success small" type="button" data-receive-week="1">' + esc(t('receive_register')) + '</button>' : '') + '</div>'
                        : '')
                + '<div class="weekly-teacher-list">'
                + (teachers.length ? teachers.map((teacher) => {
                    const row = weeklyMap.get(Number(teacher.id));
                    const isCurrent = Number(teacher.id) === Number(state.user?.id);
                    const status = row?.status || 'pending';
                    const canSign = isCurrent && state.user?.role === 'teacher' && (!row || row.status === 'needs_resign');
                    return '<article class="weekly-teacher-row">'
                        + '<div><strong>' + esc(teacher.full_name) + '</strong><small>' + esc(teacher.employee_id || '') + '</small></div>'
                        + '<span class="weekly-teacher-status ' + esc(status) + '">' + esc(status === 'signed' ? t('week_signed') : status === 'needs_resign' ? t('week_needs_resign') : t('week_pending')) + '</span>'
                        + (canSign ? '<button class="btn primary small" type="button" data-sign-week="1">' + esc(t('sign_week')) + '</button>' : '')
                        + '</article>';
                }).join('') : '<p class="empty-state">' + esc(t('no_class_teachers')) + '</p>')
                + '</div>';
        }

        this.stats();
    },

    students() {
        const box = document.querySelector('#studentsList');
        const count = document.querySelector('#studentCount');
        if (!box) return;
        if (count) count.textContent = `${state.students.length} ${t('students')}`;
        box.innerHTML = '';
        for (const student of state.students) {
            const item = document.createElement('article');
            item.className = 'student-card';
            const transfer = state.user?.role === 'admin' ? '<button class="btn small" data-transfer-student="' + esc(student.id) + '" type="button">' + esc(t('transfer')) + '</button>' : '';
            item.innerHTML = '<div><strong>' + esc(displayName(student)) + '</strong><small>' + esc(student.massar_code || t('no_massar')) + ' · ' + esc(student.student_number || t('no_student_number')) + '</small></div><div class="dialog-actions">' + transfer + '<button class="btn small" data-edit-student="' + esc(student.id) + '" type="button">' + esc(t('edit')) + '</button><button class="btn danger small" data-delete-student="' + esc(student.id) + '" type="button">' + esc(t('deactivate')) + '</button></div>';
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

    schoolImport() {
        const review = document.querySelector('#schoolImportReview');
        const yearSelect = document.querySelector('#schoolImportAcademicYearInput');
        if (yearSelect) {
            const current = yearSelect.value;
            yearSelect.innerHTML = state.academicYears.map((year) =>
                '<option value="' + esc(year.id) + '">' + esc(year.name) + (Number(year.is_active) === 1 ? ' · ' + esc(t('active')) : '') + '</option>'
            ).join('');
            if (current && [...yearSelect.options].some((option) => option.value === current)) {
                yearSelect.value = current;
            } else {
                const active = state.academicYears.find((year) => Number(year.is_active) === 1);
                if (active) yearSelect.value = String(active.id);
            }
        }

        if (!review) return;
        const data = state.schoolImport;
        if (!data?.batch) {
            review.innerHTML = '<div class="empty-state">' + esc(t('school_import_no_batch')) + '</div>';
            return;
        }

        const batch = data.batch;
        const classes = Array.isArray(data.classes) ? data.classes : [];
        const summary = data.summary || {};
        const ready = data.ready_to_import === true;
        const sourceYear = batch.source_academic_year || '—';
        const targetYear = batch.target_academic_year_name || batch.target_academic_year_id || '—';
        const targetName = (id) => {
            const target = state.adminClasses.find((cls) => Number(cls.id) === Number(id));
            return target ? target.name : (id ? '#' + id : '—');
        };
        const statusLabel = (status) => ({
            mapped: t('school_import_mapped'),
            error: t('school_import_blocked'),
            valid: t('school_import_valid'),
            warning: t('school_import_warning'),
            imported: t('school_import_imported')
        }[status] || status || '—');
        const issueText = (issues) => {
            const list = Array.isArray(issues) ? issues : [];
            return list.map((issue) => {
                const key = 'school_issue_' + issue;
                const translated = t(key);
                return translated === key ? issue : translated;
            }).join(' · ') || '—';
        };

        review.innerHTML =
            '<div class="school-import-review-head">'
            + '<div><h3>' + esc(batch.original_filename) + '</h3>'
            + '<p>' + esc(t('school_import_source')) + ': <strong>' + esc(sourceYear) + '</strong> · '
            + esc(t('school_import_target')) + ': <strong>' + esc(targetYear) + '</strong></p></div>'
            + '<span class="school-import-status ' + (ready ? 'ready' : (batch.status === 'imported' ? 'imported' : 'blocked')) + '">'
            + esc(batch.status === 'imported' ? t('school_import_imported') : (ready ? t('school_import_ready') : t('school_import_review_required')))
            + '</span></div>'
            + '<div class="school-import-metrics">'
            + '<article><span>' + esc(t('classes')) + '</span><strong>' + Number(batch.total_classes) + '</strong></article>'
            + '<article><span>' + esc(t('students')) + '</span><strong>' + Number(batch.total_rows) + '</strong></article>'
            + '<article><span>' + esc(t('school_import_new')) + '</span><strong>' + Number(summary.new_students || 0) + '</strong></article>'
            + '<article><span>' + esc(t('school_import_existing')) + '</span><strong>' + Number(summary.existing_students || 0) + '</strong></article>'
            + '<article><span>' + esc(t('school_import_conflicts')) + '</span><strong>' + Number(summary.conflict_rows || 0) + '</strong></article>'
            + '</div>'
            + '<div class="table-scroll"><table class="school-import-classes-table"><thead><tr>'
            + '<th>' + esc(t('school_import_source_class')) + '</th>'
            + '<th>' + esc(t('school_import_target_class')) + '</th>'
            + '<th>' + esc(t('students')) + '</th>'
            + '<th>' + esc(t('status')) + '</th>'
            + '<th>' + esc(t('issues')) + '</th>'
            + '<th>' + esc(t('details')) + '</th>'
            + '</tr></thead><tbody>'
            + (classes.map((item) =>
                '<tr class="' + (data.selectedClassId === Number(item.id) ? 'selected' : '') + '">'
                + '<td>' + esc(item.source_class_name || '—') + '<small>' + esc([item.source_sheet, item.source_academic_year].filter(Boolean).join(' · ')) + '</small></td>'
                + '<td>' + esc(targetName(item.target_class_id)) + '</td>'
                + '<td>' + Number(item.student_count || 0) + '</td>'
                + '<td><span class="school-import-badge ' + esc(item.status || '') + '">' + esc(statusLabel(item.status)) + '</span></td>'
                + '<td>' + esc(issueText(item.issues)) + '</td>'
                + '<td><button class="btn small" type="button" data-school-import-class="' + esc(item.id) + '">' + esc(t('school_import_view_students')) + '</button></td>'
                + '</tr>'
            ).join('') || '<tr><td colspan="6" class="empty-state">' + esc(t('school_import_no_classes')) + '</td></tr>')
            + '</tbody></table></div>'
            + '<div id="schoolImportRowsReview" class="school-import-rows-review"></div>'
            + '<div class="school-import-actions">'
            + '<button class="btn" id="schoolImportReconcileBtn" type="button" ' + (batch.status === 'imported' ? 'disabled' : '') + '>' + esc(t('school_import_reconcile')) + '</button>'
            + '<button class="btn success" id="schoolImportCommitBtn" type="button" ' + (!ready || batch.status === 'imported' ? 'disabled' : '') + '>' + esc(t('school_import_commit')) + '</button>'
            + '</div>'
            + '<p class="school-import-review-note">' + esc(ready ? t('school_import_ready_note') : t('school_import_blocking_note')) + '</p>';

        const rowsBox = document.querySelector('#schoolImportRowsReview');
        if (rowsBox && data.selectedRows) {
            const rows = Array.isArray(data.selectedRows.rows) ? data.selectedRows.rows : [];
            const conflictRows = rows.filter((row) => row.match_status === 'conflict' || row.status === 'error');
            rowsBox.innerHTML =
                '<div class="school-import-rows-head"><h4>' + esc(t('school_import_student_review')) + '</h4>'
                + '<span>' + Number(rows.length) + ' / ' + Number(data.selectedRows.total || rows.length) + '</span></div>'
                + '<div class="table-scroll"><table><thead><tr>'
                + '<th>' + esc(t('row')) + '</th><th>' + esc(t('student')) + '</th><th>' + esc(t('massar')) + '</th>'
                + '<th>' + esc(t('school_import_match')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('issues')) + '</th>'
                + '</tr></thead><tbody>'
                + (rows.map((row) =>
                    '<tr class="' + ((row.match_status === 'conflict' || row.status === 'error') ? 'conflict' : '') + '">'
                    + '<td>' + esc(row.roster_number || row.source_row || '—') + '</td>'
                    + '<td>' + esc([row.first_name, row.last_name].filter(Boolean).join(' ')) + '</td>'
                    + '<td>' + esc(row.massar_code || '—') + '</td>'
                    + '<td>' + esc(row.match_status || '—') + '</td>'
                    + '<td>' + esc(row.status || '—') + '</td>'
                    + '<td>' + esc(issueText(row.issues)) + '</td></tr>'
                ).join('') || '<tr><td colspan="6" class="empty-state">' + esc(t('school_import_no_rows')) + '</td></tr>')
                + '</tbody></table></div>'
                + (conflictRows.length ? '<p class="school-import-conflict-note">' + esc(t('school_import_conflict_note')) + '</p>' : '');
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
                    + '<td>' + (active ? t('yes') : t('no')) + '</td>'
                    + '<td>'
                    + '<button class="btn small" data-edit-user="' + esc(user.id) + '" type="button">' + esc(t('edit')) + '</button> '
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
                    + '<td>' + (active ? t('yes') : t('no')) + '</td>'
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
            head.innerHTML = '<tr><th>' + esc(t('student')) + '</th><th>' + esc(t('present_count')) + '</th><th>' + esc(t('absent_count_label')) + '</th><th>' + esc(t('late')) + '</th><th>' + esc(t('excused')) + '</th><th>' + esc(t('recorded_days')) + '</th><th>' + esc(t('history')) + '</th></tr>';
            const rows = Array.isArray(data?.students) ? data.students : [];
            body.innerHTML = rows.map((row) => '<tr><td>' + esc((String(row.first_name || '') + ' ' + String(row.last_name || '')).trim()) + '</td>'
                + '<td>' + Number(row.present_count) + '</td><td>' + Number(row.absent_count) + '</td><td>' + Number(row.late_count) + '</td><td>' + Number(row.excused_count) + '</td><td>' + Number(row.recorded_days) + '</td>'
                + '<td><button class="btn small" type="button" data-student-history="' + esc(row.id) + '">' + esc(t('view')) + '</button></td></tr>').join('')
                || '<tr><td colspan="7" class="empty-state">' + esc(t('no_records')) + '</td></tr>';
            return;
        }
        head.innerHTML = '<tr><th>' + esc(t('date')) + '</th><th>' + esc(t('records')) + '</th><th>' + esc(t('present_count')) + '</th><th>' + esc(t('absent_count_label')) + '</th><th>' + esc(t('late')) + '</th><th>' + esc(t('excused')) + '</th><th>' + esc(t('details')) + '</th></tr>';
        const rows = Array.isArray(data?.days) ? data.days : [];
        body.innerHTML = rows.map((row) => '<tr><td>' + esc(row.attendance_date) + '</td><td>' + Number(row.recorded_count) + '</td><td>' + Number(row.present_count) + '</td><td>' + Number(row.absent_count) + '</td><td>' + Number(row.late_count) + '</td><td>' + Number(row.excused_count) + '</td>'
            + '<td><button class="btn small" type="button" data-archive-day="' + esc(row.attendance_date) + '">' + esc(t('open')) + '</button></td></tr>').join('')
            || '<tr><td colspan="7" class="empty-state">' + esc(t('no_records')) + '</td></tr>';
    },
    stats() {
        const absent = state.attendance.filter((row) => row.status === 'absent').length;
        const periodRows = Array.isArray(state.attendanceSignoffs?.period_signoffs) ? state.attendanceSignoffs.period_signoffs : [];
        const signed = periodRows.filter((row) => row.status === 'signed').length;
        const needsResign = periodRows.filter((row) => row.status === 'needs_resign').length;
        const weeklyRows = Array.isArray(state.attendanceSignoffs?.weekly_signatures) ? state.attendanceSignoffs.weekly_signatures : [];
        const weeklySigned = weeklyRows.filter((row) => row.status === 'signed').length;

        const absentEl = document.querySelector('#statAbsent');
        const signedEl = document.querySelector('#statSigned');
        const needsEl = document.querySelector('#statNeedsResign');
        const weeklyEl = document.querySelector('#statWeeklySignatures');
        if (absentEl) absentEl.textContent = String(absent);
        if (signedEl) signedEl.textContent = String(signed);
        if (needsEl) needsEl.textContent = String(needsResign);
        if (weeklyEl) weeklyEl.textContent = String(weeklySigned);
    },


    statistics() {
        const box = document.querySelector('#statisticsGrid');
        if (!box) return;
        const signoffRows = Array.isArray(state.attendanceSignoffs?.period_signoffs)
            ? state.attendanceSignoffs.period_signoffs
            : [];
        const signedLessonRows = signoffRows.filter((row) => row.status === 'signed');
        const signedLessons = signedLessonRows.length;
        const signedLessonKeys = new Set(
            signedLessonRows.map((row) => String(row.attendance_date) + '|' + Number(row.period))
        );
        box.innerHTML = '';

        for (const student of state.students) {
            const absent = state.attendance.filter((row) =>
                Number(row.student_id) === Number(student.id)
                && row.status === 'absent'
                && signedLessonKeys.has(String(row.attendance_date) + '|' + Number(row.period))
            ).length;
            const certifiedPresent = Math.max(0, signedLessons - absent);
            const rate = signedLessons > 0 ? attendanceRate(certifiedPresent, signedLessons) : 0;
            const card = document.createElement('article');
            card.className = `stat-card ${absent >= 8 ? 'risk' : ''}`;
            card.innerHTML = '<strong>' + esc(displayName(student)) + '</strong>'
                + '<span>' + absent + ' ' + esc(t('absences_count')) + '</span>'
                + '<span>' + certifiedPresent + ' ' + esc(t('certified_presence_count')) + '</span>'
                + '<span>' + signedLessons + ' ' + esc(t('signed_lessons_count')) + '</span>'
                + '<b>' + rate + '%</b>';
            box.appendChild(card);
        }
    }
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
    ui.schoolImport();
    ui.admin();
    if (state.archive) ui.archive(state.archive, state.archiveView || 'days');
}
