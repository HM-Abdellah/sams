import { API, setCsrf, getCsrf } from './api.js';
import { state, setState } from './state.js';
import { ui, renderAll } from './ui.js';
import { setupSignature } from './signature.js';
import { DAYS, PERIODS, dateFromWeek, startOfWeek, attendanceKey, displayName } from './logic.js';
import { currentLanguage, initLanguage, setLanguage, t } from './i18n.js';

let loading = false;
let clickTimer = null;
let attendanceFlushTimer = null;
let attendanceFlushPromise = null;
let adminRefreshTimer = null;
let presenceTimer = null;
let attendanceVersion = 0;
const pendingAttendance = new Map();

function localDateString() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function currentMonth() {
    return state.month || localDateString().slice(0, 7);
}

function setOperationalClasses(classes) {
    const list = Array.isArray(classes) ? classes : [];
    const currentId = Number(state.classId || 0);
    const currentStillAvailable = list.some((item) => Number(item.id) === currentId);

    setState({
        classes: list,
        classId: currentStillAvailable ? state.classId : (list[0]?.id ?? null),
    });
}

async function loadClass() {
    if (!state.classId) return;
    if (!await flushAttendanceQueue()) return;
    try {
        ui.setLoading?.(true);
        const [students, attendance, signoffs] = await Promise.all([
            API.students(state.classId),
            API.attendanceWeek(state.classId, state.weekStart),
            API.attendanceSignoffs(state.classId, state.weekStart),
        ]);
        setState({
            students: students.students || [],
            attendance: attendance.attendance || [],
            attendanceSignoffs: signoffs || { week_start: state.weekStart, week_end: dateFromWeek(state.weekStart, 5), teachers: [], period_signoffs: [], weekly_signatures: [], submission: null },
            selectedDay: state.selectedDay || state.weekStart,
        });
        renderAll();
        await loadSignature();
    } catch (error) {
        ui.toast(error.message || t('startup_load_error'), true);
    } finally {
        ui.setLoading?.(false);
    }
}

async function boot() {
    if (loading) return;
    loading = true;
    try {
        const session = await API.session();
        if (!session.authenticated) {
            window.location.href = 'login.php';
            return;
        }

        setCsrf(session.csrf || '');
        const month = currentMonth();
        const defaultWeekStart = startOfWeek(localDateString());
        setState({
            user: session.user,
            csrf: session.csrf || '',
            month,
            weekStart: state.weekStart || defaultWeekStart,
            selectedDay: state.selectedDay || defaultWeekStart,
            selectedPeriod: state.selectedPeriod || 1,
        });
        ensureArchiveDynamicUI();
        ensureAdminDynamicUI();
        initLanguage();
        await startPresenceHeartbeat();

        const classes = await API.classes();
        const list = Array.isArray(classes.classes) ? classes.classes : [];
        setOperationalClasses(list);

        const weekInput = document.querySelector('#weekStart');
        if (weekInput) weekInput.value = state.weekStart;

        const currentUser = document.querySelector('#currentUser');
        if (currentUser && state.user) {
            const roleKey = state.user.role === 'admin' ? 'role_admin' : state.user.role === 'teacher' ? 'role_teacher' : 'role_counselor';
            currentUser.textContent = `${state.user.full_name} · ${t(roleKey)}`;
        }

        if (state.user?.role !== 'admin') document.querySelectorAll('.admin-only').forEach((el) => el.remove());
        renderAll();
        if (state.classId) await loadClass();
        if (state.user?.role === 'admin') {
            await loadAdmin();
        }
    } catch (error) {
        ui.toast(error.message || t('startup_error'), true);
    } finally {
        loading = false;
    }
}

function ensureArchiveDynamicUI() {
    if (!document.querySelector('#archiveDayDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'archiveDayDialog';
        dialog.innerHTML = '<form><h2 data-i18n="day_attendance">Présences du jour</h2><div id="archiveDayContent"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="archiveDayDialog" data-i18n="close">Fermer</button></div></form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#studentHistoryDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'studentHistoryDialog';
        dialog.innerHTML = '<form><h2 data-i18n="student_history">Historique de l’élève</h2><div id="studentHistoryContent"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="studentHistoryDialog" data-i18n="close">Fermer</button></div></form>';
        document.body.appendChild(dialog);
    }
}

function displayStudentName(row) {
    return [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
}

async function openArchiveDay(date) {
    if (!state.classId || !date) return;
    try {
        const result = await API.archiveDay(state.classId, date);
        const dialog = document.querySelector('#archiveDayDialog');
        const content = document.querySelector('#archiveDayContent');
        if (!dialog || !content) return;
        const rows = Array.isArray(result.records) ? result.records : [];
        const students = new Map();
        for (const row of rows) {
            const id = Number(row.student_id);
            if (!students.has(id)) students.set(id, { name: displayStudentName(row), massar: row.massar_code || '—', periods: new Map() });
            if (row.period != null && row.status) students.get(id).periods.set(Number(row.period), row.status);
        }
        const periodLabel = (period) => PERIODS[period - 1] || String(period);
        content.innerHTML = '<p><strong>' + esc(result.class?.name || '') + '</strong> · ' + esc(date) + '</p>'
            + (students.size
                ? '<div class="table-scroll"><table><thead><tr><th>' + esc(t('student')) + '</th><th>' + esc(t('massar')) + '</th>' + Array.from({length:8}, (_, i) => '<th>' + (i + 1) + '</th>').join('') + '</tr></thead><tbody>'
                    + [...students.values()].map((student) => '<tr><td>' + esc(student.name) + '</td><td>' + esc(student.massar) + '</td>'
                        + Array.from({length:8}, (_, i) => { const status = student.periods.get(i + 1) || ''; return '<td title="' + esc(periodLabel(i + 1)) + '">' + statusMark(status) + '</td>'; }).join('')
                        + '</tr>').join('')
                    + '</tbody></table></div>'
                : '<p class="empty-state">' + esc(t('no_student_attendance')) + '</p>');
        setLanguage(currentLanguage());
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || t('archive_day_error'), true);
    }
}

function statusMark(status) {
    return status === 'present' ? '✓' : status === 'absent' ? '✕' : status === 'late' ? 'L' : status === 'excused' ? 'E' : '·';
}

function attendanceStatusLabel(status) {
    const key = status === 'present' ? 'status_present' : status === 'absent' ? 'status_absent' : status === 'late' ? 'status_late' : status === 'excused' ? 'status_excused' : 'status_not_marked';
    return t(key);
}

async function openStudentHistory(studentId) {
    if (!state.classId || !studentId) return;
    try {
        const result = await API.studentHistory(state.classId, studentId);
        const dialog = document.querySelector('#studentHistoryDialog');
        const content = document.querySelector('#studentHistoryContent');
        if (!dialog || !content) return;
        const rows = Array.isArray(result.history) ? result.history : [];
        const first = rows[0];
        const attendanceRows = rows.filter((row) => row.attendance_id != null);
        content.innerHTML = '<p><strong>' + esc([first?.first_name, first?.last_name].filter(Boolean).join(' ')) + '</strong>'
            + ' · ' + esc(t('massar')) + ': ' + esc(first?.massar_code || '—')
            + ' · ' + esc(t('class')) + ': ' + esc(result.class?.name || first?.class_name || '—') + '</p>'
            + '<div class="table-scroll"><table><thead><tr><th>' + esc(t('date')) + '</th><th>' + esc(t('period')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>'
            + (attendanceRows.map((row) => '<tr><td>' + esc(row.attendance_date) + '</td><td>' + Number(row.period) + '</td><td>' + esc(attendanceStatusLabel(row.status)) + '</td></tr>').join('')
                || '<tr><td colspan="3" class="empty-state">' + esc(t('no_student_history')) + '</td></tr>')
            + '</tbody></table></div>';
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || t('student_history_error'), true);
    }
}
function ensureAdminDynamicUI() {
    if (!document.querySelector('#adminClassesTable')) {
        const table = document.createElement('div');
        table.className = 'table-scroll';
        table.innerHTML = '<table id="adminClassesTable"><thead></thead><tbody></tbody></table>';
        const panel = document.querySelector('[data-panel="admin"]');
        panel?.appendChild(table);
    }

    if (!document.querySelector('#editClassDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'editClassDialog';
        dialog.innerHTML = '<form id="editClassForm">'
            + '<h2 data-i18n="edit_class">Modifier une classe</h2>'
            + '<input id="editClassId" type="hidden">'
            + '<label><span data-i18n="name">Nom</span><input id="editClassNameInput" required maxlength="100"></label>'
            + '<label><span data-i18n="level">Niveau</span><input id="editClassLevelInput" maxlength="50"></label>'
            + '<label><span data-i18n="branch">Branche</span><input id="editClassBranchInput" maxlength="100"></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editClassDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="save">Enregistrer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#editUserDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'editUserDialog';
        dialog.innerHTML = '<form id="editUserForm">'
            + '<h2 data-i18n="edit_user">Modifier un utilisateur</h2>'
            + '<input id="editUserId" type="hidden">'
            + '<label><span data-i18n="full_name">Nom complet</span><input id="editUserFullNameInput" required maxlength="120"></label>'
            + '<label><span data-i18n="role">Rôle</span><select id="editUserRoleInput"><option value="teacher" data-i18n="role_teacher">Enseignant</option><option value="counselor" data-i18n="role_counselor">Conseiller</option><option value="admin" data-i18n="role_admin">Administrateur</option></select></label>'
            + '<label><span data-i18n="active">Actif</span><select id="editUserActiveInput"><option value="1">Oui</option><option value="0">Non</option></select></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editUserDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="save">Enregistrer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#transferStudentDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'transferStudentDialog';
        dialog.innerHTML = '<form id="transferStudentForm">'
            + '<h2 data-i18n="transfer">Transférer un élève</h2>'
            + '<input id="transferStudentId" type="hidden">'
            + '<label><span data-i18n="target_class">Classe cible</span><select id="transferTargetClassInput" required></select></label>'
            + '<label><span data-i18n="effective_date">Date d’effet</span><input id="transferEffectiveDateInput" type="date" required></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="transferStudentDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="transfer">Transférer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#resetUserPasswordDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'resetUserPasswordDialog';
        dialog.innerHTML = '<form id="resetUserPasswordForm">'
            + '<h2 data-i18n="reset_password">Réinitialiser le mot de passe</h2>'
            + '<input id="resetUserId" type="hidden">'
            + '<label><span data-i18n="new_password">Nouveau mot de passe</span><input id="resetUserPasswordInput" type="password" minlength="10" maxlength="255" required></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="resetUserPasswordDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="reset">Réinitialiser</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }
    const transferTarget = document.querySelector('#transferTargetClassInput');
    if (transferTarget) {
        transferTarget.innerHTML = state.classes
            .filter((cls) => Number(cls.id) !== Number(state.classId))
            .map((cls) => '<option value="' + esc(cls.id) + '">' + esc(cls.name) + '</option>')
            .join('');
    }

    const adminPanel = document.querySelector('[data-panel="admin"]');
    if (!adminPanel) return;

    if (!document.querySelector('#assignmentsTable')) {
        const table = document.createElement('div');
        table.className = 'table-scroll';
        table.innerHTML = '<table id="assignmentsTable"><thead></thead><tbody></tbody></table>';
        const form = document.querySelector('#assignmentForm');
        form?.insertAdjacentElement('afterend', table);
    }

    if (!document.querySelector('#academicYearsTable')) {
        const table = document.createElement('div');
        table.className = 'table-scroll';
        table.innerHTML = '<table id="academicYearsTable"><thead></thead><tbody></tbody></table>';
        const form = document.querySelector('#academicYearForm');
        form?.insertAdjacentElement('afterend', table);
    }

    if (!document.querySelector('#importCorrectionDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'importCorrectionDialog';
        dialog.innerHTML = '<form id="importCorrectionForm"><h2 data-i18n="correct_invalid_rows">Corriger les lignes invalides</h2><div id="importCorrectionRows"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="importCorrectionDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit" data-i18n="correct_and_revalidate">Corriger et revalider</button></div></form>';
        document.body.appendChild(dialog);
    }
    if (!document.querySelector('#schoolImportCommitDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'schoolImportCommitDialog';
        dialog.innerHTML = '<form method="dialog" id="schoolImportCommitForm">'
            + '<h2 data-i18n="school_import_commit_title">Confirmer l’import final</h2>'
            + '<div id="schoolImportCommitSummary"></div>'
            + '<label class="school-import-review-check"><input id="schoolImportReviewedInput" type="checkbox"><span data-i18n="school_import_review_confirm">J’ai vérifié le mapping et les correspondances affichés ci-dessus.</span></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="schoolImportCommitDialog" data-i18n="cancel">Annuler</button><button class="btn success" id="schoolImportCommitConfirmBtn" type="button" disabled data-i18n="school_import_commit">Importer définitivement</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }
}

async function openImportCorrection(batchId) {
    try {
        const result = await API.importBatch(batchId);
        const dialog = document.querySelector('#importCorrectionDialog');
        const container = document.querySelector('#importCorrectionRows');
        if (!dialog || !container) return;

        const rows = (result.rows || []).filter((row) => row.status !== 'valid');
        if (!rows.length) {
            ui.toast(t('import_rows_none'));
            return;
        }

        container.innerHTML = '';
        for (const row of rows) {
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'import-correction-row';
            fieldset.dataset.rowId = String(row.id);
            fieldset.innerHTML = '<legend>' + String(row.row_number) + '</legend>'
                + '<small>' + uiEscapeIssues(row.issues) + '</small>'
                + '<label><span data-i18n="first_name">Prénom</span><input name="first_name" required maxlength="80" value="' + uiEscapeValue(row.first_name) + '"></label>'
                + '<label><span data-i18n="last_name">Nom</span><input name="last_name" required maxlength="80" value="' + uiEscapeValue(row.last_name) + '"></label>'
                + '<label><span data-i18n="massar">Massar</span><input name="massar_code" required maxlength="32" value="' + uiEscapeValue(row.massar_code) + '"></label>'
                + '<label><span data-i18n="birth_date">Date de naissance</span><input name="birth_date" type="date" required value="' + uiEscapeValue(row.birth_date) + '"></label>'
                + '<label><span data-i18n="student_number">N° élève</span><input name="student_number" maxlength="30" value="' + uiEscapeValue(row.student_number) + '"></label>';
            container.appendChild(fieldset);
        }
        setLanguage(currentLanguage());

        dialog.dataset.batchId = String(batchId);
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || t('import_rows_error'), true);
    }
}

function uiEscapeValue(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML.replaceAll('"', '&quot;');
}

function uiEscapeIssues(value) {
    const div = document.createElement('div');
    const items = Array.isArray(value) ? value : [];
    div.textContent = items.join(' · ');
    return div.innerHTML;
}

async function loadAdmin() {
    if (state.user?.role !== 'admin') return;
    try {
        ensureAdminDynamicUI();
        const requests = [
            API.users(),
            API.adminClasses(),
            API.academicYears(),
            state.classId ? API.imports(state.classId) : Promise.resolve({ imports: [] }),
            state.classId ? API.teacherClasses({ classId: state.classId }) : Promise.resolve({ teachers: [] }),
            API.audit({ page: 1, per_page: 20 }),
            API.adminDashboard(),
        ];
        const [users, classes, academicYears, imports, assignments, audit, dashboard] = await Promise.all(requests);
        setState({
            users: users.users || [],
            adminClasses: classes.classes || [],
            academicYears: academicYears.academic_years || [],
            imports: imports.imports || [],
            assignments: assignments.teachers || [],
            auditItems: audit.items || [],
            adminDashboard: dashboard || null,
        });
        renderAll();
    } catch (error) {
        ui.toast(error.message || t('admin_load_error'), true);
    }
}

async function loadTeachers() {
    if (state.user?.role !== 'admin') return;
    try {
        const data = await API.teachers();
        setState({
            teachers: data.teachers || [],
            subjects: data.subjects || [],
            teachings: data.teachings || [],
        });
        renderAll();
    } catch (error) {
        ui.toast(error.message || t('teachers_load_error'), true);
    }
}

function restartAdminRefresh() {
    clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
    if (state.user?.role !== 'admin') return;

    if (state.tab === 'teachers') {
        adminRefreshTimer = setInterval(() => loadTeachers(), 15000);
    } else if (state.tab === 'admin') {
        adminRefreshTimer = setInterval(() => loadAdmin(), 30000);
    }
}

async function startPresenceHeartbeat() {
    if (presenceTimer) return;
    const send = async () => {
        try {
            await API.presence();
        } catch {
            // Presence is best-effort; authentication and app operation must continue.
        }
    };
    await send();
    presenceTimer = setInterval(send, 30000);
}

async function loadArchive(view = 'days') {
    if (!state.classId) return;
    try {
        const month = document.querySelector('#archiveMonth')?.value || state.month;
        const data = view === 'month'
            ? await API.archiveMonth(state.classId, month)
            : await API.archiveDays(state.classId, month);
        setState({ archive: data, archiveView: view });
        renderAll();
    } catch (error) {
        ui.toast(error.message || t('archive_load_error'), true);
    }
}

function attendanceEntryKey(payload) {
    return String(payload.student_id) + '|' + payload.attendance_date + '|' + payload.period;
}

function localAttendanceStatus(payload) {
    const row = state.attendance.find((item) =>
        Number(item.student_id) === payload.student_id
        && String(item.attendance_date) === payload.attendance_date
        && Number(item.period) === payload.period
    );
    return row?.status || '';
}

function setLocalAttendanceStatus(payload, status) {
    const index = state.attendance.findIndex((item) =>
        Number(item.student_id) === payload.student_id
        && String(item.attendance_date) === payload.attendance_date
        && Number(item.period) === payload.period
    );

    if (status === '') {
        if (index >= 0) state.attendance.splice(index, 1);
        return;
    }

    if (index >= 0) {
        state.attendance[index].status = status;
        return;
    }

    state.attendance.push({
        id: null,
        student_id: payload.student_id,
        attendance_date: payload.attendance_date,
        period: payload.period,
        status,
    });
}

function paintAttendanceCell(td, status) {
    if (!td) return;
    td.className = ['attendance-cell', status].filter(Boolean).join(' ');
    td.dataset.status = status;
    td.textContent = status === 'present' ? '✓'
        : status === 'absent' ? '✕'
        : status === 'late' ? 'L'
        : status === 'excused' ? 'E'
        : '·';
}

function scheduleAttendanceFlush() {
    clearTimeout(attendanceFlushTimer);
    attendanceFlushTimer = setTimeout(() => {
        flushAttendanceQueue();
    }, 500);
}

function queueAttendanceChange(td, status) {
    if (!state.classId || !td) return;

    const payload = {
        student_id: Number(td.dataset.student),
        attendance_date: td.dataset.date,
        period: Number(td.dataset.period),
    };
    const key = attendanceEntryKey(payload);
    const currentStatus = localAttendanceStatus(payload);
    const pending = pendingAttendance.get(key);

    pendingAttendance.set(key, {
        ...payload,
        action: status === '' ? 'delete' : 'upsert',
        status: status || null,
        previousStatus: pending?.previousStatus ?? currentStatus,
        version: ++attendanceVersion,
    });

    setLocalAttendanceStatus(payload, status);
    paintAttendanceCell(td, status);
    ui.stats();
    ui.statistics();
    scheduleAttendanceFlush();
}

function invalidateLocalSignoffs(entries) {
    const current = state.attendanceSignoffs || {};
    const periodRows = Array.isArray(current.period_signoffs) ? current.period_signoffs.slice() : [];
    const weekRows = Array.isArray(current.weekly_signatures) ? current.weekly_signatures.slice() : [];
    let periodChanged = false;
    let weekChanged = false;

    for (const entry of entries) {
        const periodRow = periodRows.find((row) =>
            String(row.attendance_date) === String(entry.attendance_date) && Number(row.period) === Number(entry.period)
        );
        if (periodRow && periodRow.status === 'signed') {
            periodRow.status = 'needs_resign';
            periodRow.invalidated_at = new Date().toISOString();
            periodChanged = true;
        }

        const weekStart = startOfWeek(entry.attendance_date);
        for (const row of weekRows) {
            if (String(row.week_start) === String(weekStart) && row.status === 'signed') {
                row.status = 'needs_resign';
                row.invalidated_at = new Date().toISOString();
                weekChanged = true;
            }
        }
    }

    if (periodChanged || weekChanged) {
        setState({
            attendanceSignoffs: {
                ...current,
                period_signoffs: periodRows,
                weekly_signatures: weekRows,
                submission: null,
            },
        });
    }
}

async function flushAttendanceQueue() {
    if (!state.classId || pendingAttendance.size === 0) return true;
    if (attendanceFlushPromise) return attendanceFlushPromise;

    attendanceFlushPromise = (async () => {
        try {
            while (pendingAttendance.size > 0) {
                const batch = [...pendingAttendance.entries()].slice(0, 500);
                for (const [key] of batch) pendingAttendance.delete(key);

                const entries = batch.map(([, entry]) => ({
                    student_id: entry.student_id,
                    attendance_date: entry.attendance_date,
                    period: entry.period,
                    action: entry.action,
                    ...(entry.action === 'upsert' ? { status: entry.status } : {}),
                }));

                try {
                    await API.bulkAttendance(state.classId, entries);
                    invalidateLocalSignoffs(entries);
                    ui.attendance();
                    ui.stats();
                } catch (error) {
                    for (const [key, entry] of batch) {
                        const current = pendingAttendance.get(key);
                        if (current && current.version !== entry.version) continue;

                        setLocalAttendanceStatus(entry, entry.previousStatus || '');
                    }

                    ui.attendance();
                    ui.stats();
                    ui.statistics();
                    ui.toast(error.message || t('attendance_save_failed'), true);
                    return false;
                }
            }

            return true;
        } finally {
            attendanceFlushPromise = null;
        }
    })();

    return attendanceFlushPromise;
}

function currentPeriodSignoff() {
    const date = state.selectedDay || state.weekStart;
    const period = Number(state.selectedPeriod || 1);
    return (state.attendanceSignoffs?.period_signoffs || []).find((row) =>
        String(row.attendance_date) === String(date) && Number(row.period) === period
    ) || null;
}

function queueAttendanceToggle(studentId) {
    const date = state.selectedDay || state.weekStart;
    const period = Number(state.selectedPeriod || 1);
    if (!state.classId || !date || !studentId) return;

    const signoff = currentPeriodSignoff();
    if (signoff?.status === 'signed') {
        ui.toast(t('api_signed_lesson'), true);
        return;
    }

    const payload = { student_id: Number(studentId), attendance_date: date, period };
    const currentStatus = localAttendanceStatus(payload);
    const nextStatus = currentStatus === 'absent' ? '' : 'absent';
    const key = attendanceEntryKey(payload);
    const pending = pendingAttendance.get(key);

    pendingAttendance.set(key, {
        ...payload,
        action: nextStatus === '' ? 'delete' : 'upsert',
        status: nextStatus || null,
        previousStatus: pending?.previousStatus ?? currentStatus,
        version: ++attendanceVersion,
    });

    setLocalAttendanceStatus(payload, nextStatus);
    ui.attendance();
    ui.stats();
    ui.statistics();
    scheduleAttendanceFlush();
}

async function loadAttendanceSignoffs() {
    if (!state.classId || !state.weekStart) return;
    try {
        const result = await API.attendanceSignoffs(state.classId, state.weekStart);
        setState({ attendanceSignoffs: result || { week_start: state.weekStart, week_end: dateFromWeek(state.weekStart, 5), teachers: [], period_signoffs: [], weekly_signatures: [], submission: null } });
        renderAll();
    } catch (error) {
        ui.toast(error.message || t('attendance_signoff_load_error'), true);
    }
}

async function signSelectedLesson() {
    if (!state.classId) return;
    if (!await flushAttendanceQueue()) return;
    const signoff = currentPeriodSignoff();
    if (signoff?.status === 'signed') return;
    try {
        await API.attendanceSignoffAction(state.classId, {
            action: 'sign_period',
            attendance_date: state.selectedDay || state.weekStart,
            period: Number(state.selectedPeriod || 1),
            week_start: state.weekStart,
        });
        await loadAttendanceSignoffs();
        ui.toast(t('lesson_signed'));
    } catch (error) {
        ui.toast(error.message || t('attendance_signoff_error'), true);
    }
}

async function reopenSelectedLesson() {
    if (!state.classId) return;
    if (!await flushAttendanceQueue()) return;
    const signoff = currentPeriodSignoff();
    if (!signoff) return;
    try {
        await API.attendanceSignoffAction(state.classId, {
            action: 'reopen_period',
            attendance_date: state.selectedDay || state.weekStart,
            period: Number(state.selectedPeriod || 1),
            week_start: state.weekStart,
        });
        await loadAttendanceSignoffs();
        ui.toast(t('correction_reopened'));
    } catch (error) {
        ui.toast(error.message || t('attendance_signoff_error'), true);
    }
}

async function signSelectedWeek() {
    if (!state.classId) return;
    if (!await flushAttendanceQueue()) return;
    try {
        await API.attendanceSignoffAction(state.classId, {
            action: 'sign_week',
            week_start: state.weekStart,
        });
        await loadAttendanceSignoffs();
        ui.toast(t('week_signed_success'));
    } catch (error) {
        ui.toast(error.message || t('attendance_signoff_error'), true);
    }
}

async function receiveSelectedWeek() {
    if (!state.classId || state.user?.role !== 'admin') return;
    if (!await flushAttendanceQueue()) return;
    try {
        await API.receiveAttendanceWeek(state.classId, state.weekStart);
        await loadAttendanceSignoffs();
        ui.toast(t('register_received'));
    } catch (error) {
        ui.toast(error.message || t('attendance_signoff_error'), true);
    }
}

function shiftWeek(delta) {
    const start = new Date(state.weekStart + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() + delta * 7);
    const next = start.toISOString().slice(0, 10);
    setState({ weekStart: next, selectedDay: next });
    const input = document.querySelector('#weekStart');
    if (input) input.value = next;
    loadClass();
}

function stateLanguageLocale() {
    const lang = document.documentElement.lang || 'fr';
    return lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR';
}

function buildWeeklyPrintSheet() {
    const sheet = document.querySelector('#weeklyPrintSheet');
    if (!sheet || !state.weekStart) return;

    const currentClass = state.classes.find((item) => Number(item.id) === Number(state.classId)) || {};
    const start = state.weekStart;
    const end = dateFromWeek(start, 5);
    const attendanceMap = new Map(state.attendance.map((row) => [
        attendanceKey(row.student_id, row.attendance_date, Number(row.period)), row.status
    ]));
    const signoffRows = Array.isArray(state.attendanceSignoffs?.period_signoffs) ? state.attendanceSignoffs.period_signoffs : [];
    const signoffMap = new Map(signoffRows.map((row) => [
        String(row.attendance_date) + '|' + Number(row.period), row
    ]));
    const weeklyRows = Array.isArray(state.attendanceSignoffs?.weekly_signatures) ? state.attendanceSignoffs.weekly_signatures : [];

    const dayHeaders = DAYS.map((_, dayIndex) => {
        const date = dateFromWeek(start, dayIndex);
        const value = new Date(date + 'T00:00:00Z');
        const label = value.toLocaleDateString(stateLanguageLocale(), {
            weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC'
        });
        return '<th class="print-day" colspan="8"><strong>' + esc(label) + '</strong><small>1 · 2 · 3 · 4 · 5 · 6 · 7 · 8</small></th>';
    }).join('');

    const rows = state.students.map((student, index) => {
        let absent = 0;
        const dayCells = DAYS.map((_, dayIndex) => {
            const date = dateFromWeek(start, dayIndex);
            const marks = PERIODS.map((_, periodIndex) => {
                const period = periodIndex + 1;
                const status = attendanceMap.get(attendanceKey(student.id, date, period)) || '';
                const signoff = signoffMap.get(date + '|' + period);
                if (status === 'absent') {
                    absent += 1;
                    return '<span class="print-mark">X</span>';
                }
                return signoff?.status === 'signed'
                    ? '<span class="print-mark print-blank">&nbsp;</span>'
                    : '<span class="print-mark">·</span>';
            }).join('');
            return '<td class="print-day-cell">' + marks + '</td>';
        }).join('');
        return '<tr><td>' + (index + 1) + '</td><td class="print-name">' + esc(displayName(student)) + '</td><td>' + esc(student.student_number || '') + '</td>' + dayCells + '<td>' + absent + '</td></tr>';
    }).join('');

    const signoffDayHeaders = DAYS.map((_, dayIndex) => {
        const date = dateFromWeek(start, dayIndex);
        const label = new Date(date + 'T00:00:00Z').toLocaleDateString(stateLanguageLocale(), { weekday:'short', day:'2-digit', timeZone:'UTC' });
        return '<th>' + esc(label) + '</th>';
    }).join('');
    const signoffRowsHtml = PERIODS.map((_, periodIndex) => {
        const period = periodIndex + 1;
        const cells = DAYS.map((_, dayIndex) => {
            const row = signoffMap.get(dateFromWeek(start, dayIndex) + '|' + period);
            const mark = row?.status === 'signed' ? '✓' : row?.status === 'needs_resign' ? '!' : '·';
            return '<td>' + mark + (row?.teacher_name ? '<small>' + esc(row.teacher_name) + '</small>' : '') + '</td>';
        }).join('');
        return '<tr><th>' + period + '</th>' + cells + '</tr>';
    }).join('');

    const teachers = Array.isArray(state.attendanceSignoffs?.teachers) ? state.attendanceSignoffs.teachers : [];
    const teacherById = new Map(teachers.map((teacher) => [Number(teacher.id), teacher]));
    const weeklyTeacherRows = weeklyRows.map((row) => {
        const teacher = teacherById.get(Number(row.teacher_id));
        const subjects = Array.isArray(teacher?.subjects)
            ? teacher.subjects.map(subjectLabel).filter(Boolean).join(', ')
            : '';
        return '<tr><td>' + esc(teacher?.full_name || row.teacher_name || '') + '</td><td>' + esc(subjects || '—') + '</td><td>'
            + esc(row.status === 'signed' ? t('week_signed') : t('week_needs_resign')) + '</td><td>' + esc(row.signed_at || '') + '</td><td>'
            + (row.signature_data ? '<img class="print-signature-image" src="' + esc(row.signature_data) + '" alt="' + esc(t('teacher_signature')) + '">' : '________________')
            + '</td></tr>';
    }).join('');
    const missingWeekly = teachers.filter((teacher) => !weeklyRows.some((row) => Number(row.teacher_id) === Number(teacher.id)));
    const submission = state.attendanceSignoffs?.submission || null;
    const printWeeklyMap = new Map(weeklyRows.map((row) => [Number(row.teacher_id), row]));
    const readyForPrint = teachers.length > 0 && teachers.every((teacher) => printWeeklyMap.get(Number(teacher.id))?.status === 'signed');
    const receiptHtml = submission
        ? '<div class="print-receipt"><strong>' + esc(t('register_received')) + '</strong><span>' + esc(t('received_by')) + ': ' + esc(submission.received_by_name || '—') + ' · ' + esc(submission.received_at || '') + '</span></div>'
        : readyForPrint ? '<div class="print-receipt"><strong>' + esc(t('register_ready')) + '</strong></div>' : '';

    sheet.innerHTML =
        '<div class="print-header"><div><h1>' + esc(t('official_weekly_register')) + '</h1><p>' + esc(t('official_school_record')) + '</p></div>'
        + '<div class="print-meta"><div><strong>' + esc(t('class')) + ':</strong> ' + esc(currentClass.name || '—') + '</div>'
        + '<div><strong>' + esc(t('branch')) + ':</strong> ' + esc(currentClass.branch || '—') + '</div>'
        + '<div><strong>' + esc(t('level')) + ':</strong> ' + esc(currentClass.level || '—') + '</div>'
        + '<div><strong>' + esc(t('academic_year')) + ':</strong> ' + esc(currentClass.academic_year_name || '—') + '</div>'
        + '<div><strong>' + esc(t('week')) + ':</strong> ' + esc(start) + ' → ' + esc(end) + '</div></div></div>'
        + '<table class="print-attendance-table"><thead><tr><th rowspan="2">#</th><th rowspan="2">' + esc(t('student')) + '</th><th rowspan="2">' + esc(t('student_number_short')) + '</th>' + dayHeaders + '<th rowspan="2">' + esc(t('absence_short')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>'
        + '<div class="print-legend"><span><strong>X</strong> ' + esc(t('absent_mark')) + '</span><span><strong>□</strong> ' + esc(t('present_blank')) + '</span><span><strong>·</strong> ' + esc(t('not_certified')) + '</span></div>' + receiptHtml
        + '<h2 class="print-section-title">' + esc(t('lesson_signoffs')) + '</h2>'
        + '<table class="print-signoff-table"><thead><tr><th>' + esc(t('period')) + '</th>' + signoffDayHeaders + '</tr></thead><tbody>' + signoffRowsHtml + '</tbody></table>'
        + '<h2 class="print-section-title">' + esc(t('weekly_certification')) + '</h2>'
        + '<table class="print-weekly-signatures"><thead><tr><th>' + esc(t('teacher')) + '</th><th>' + esc(t('subject')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('signature')) + '</th></tr></thead><tbody>'
        + weeklyTeacherRows
        + missingWeekly.map((teacher) => '<tr><td>' + esc(teacher.full_name) + '</td><td>' + esc(Array.isArray(teacher.subjects) ? teacher.subjects.map(subjectLabel).filter(Boolean).join(', ') : '' || '—') + '</td><td>' + esc(t('week_pending')) + '</td><td></td><td>________________</td></tr>').join('')
        + '</tbody></table>';
}

async function printWeeklyAttendance() {
    if (!state.classId) return ui.toast(t('select_class'), true);
    if (!await flushAttendanceQueue()) return;
    buildWeeklyPrintSheet();
    window.print();
}
function nextStatus(current) {
    const order = ['', 'present', 'absent', 'late', 'excused'];
    const index = Math.max(0, order.indexOf(current));
    return order[(index + 1) % order.length];
}

async function openAnnualReport() {
    if (!state.classId) return ui.toast(t('select_class'), true);
    try {
        const report = await API.report(state.classId, currentMonth());
        const rows = (report.students || []).map((student, index) => {
            const total = Number(student.recorded_count) || 0;
            const present = Number(student.present_count) || 0;
            const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
            return '<tr><td>' + (index + 1) + '</td><td>' + esc(displayStudentName(student)) + '</td><td>' + Number(student.present_count) + '</td><td>' + Number(student.absent_count) + '</td><td>' + Number(student.other_count) + '</td><td>' + rate + '%</td></tr>';
        }).join('');
        const win = window.open('', '_blank');
        if (!win) throw new Error(t('report_window_blocked'));
        const lang = currentLanguage();
        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        const title = esc(t('monthly_analytics'));
        win.document.write('<!doctype html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="utf-8"><title>SAMS — ' + title + '</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#111}h1{text-align:center}p{text-align:center;color:#555}table{width:100%;border-collapse:collapse;margin-top:2rem}th,td{border:1px solid #aaa;padding:.55rem;text-align:center}th{background:#eee}@media print{@page{size:A4 portrait;margin:12mm}}</style></head><body><h1>' + title + '</h1><p>' + esc(report.class?.name || '') + ' · ' + esc(report.month || currentMonth()) + '</p><table><thead><tr><th>#</th><th>' + esc(t('student')) + '</th><th>' + esc(t('present_count')) + '</th><th>' + esc(t('absent_count_label')) + '</th><th>' + esc(t('other_count')) + '</th><th>' + esc(t('presence_rate')) + '</th></tr></thead><tbody>' + rows + '</tbody></table><script>window.onload=()=>window.print();</script></body></html>');
        win.document.close();
    } catch (error) {
        ui.toast(error.message || t('report_generation_error'), true);
    }
}
function esc(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function subjectLabel(subject) {
    const lang = currentLanguage();
    return subject?.['name_' + (lang === 'ar' ? 'ar' : lang === 'en' ? 'en' : 'fr')]
        || subject?.name_fr
        || subject?.subject_name_fr
        || subject?.code
        || '—';
}

async function loadSchoolImportReview(batchId, options = {}) {
    if (!batchId) return;
    try {
        const params = {};
        if (options.classId) {
            params.class_id = options.classId;
            params.page = 1;
            params.per_page = 100;
        }
        const result = await API.schoolImport(batchId, params);
        setState({
            schoolImport: {
                ...(state.schoolImport || {}),
                batch: result.batch || null,
                classes: result.classes || [],
                summary: options.summary ?? state.schoolImport?.summary ?? null,
                ready_to_import: options.readyToImport ?? state.schoolImport?.ready_to_import ?? false,
                already_imported: result.batch?.status === 'imported' || state.schoolImport?.already_imported === true,
                selectedClassId: options.classId ? Number(options.classId) : (options.clearSelection ? null : state.schoolImport?.selectedClassId ?? null),
                selectedRows: options.classId ? (result.rows || null) : (options.clearSelection ? null : state.schoolImport?.selectedRows ?? null),
            }
        });
        renderAll();
    } catch (error) {
        ui.toast(error.message || t('school_import_review_error'), true);
    }
}

async function reconcileSchoolImport(batchId) {
    if (!batchId) return;
    const button = document.querySelector('#schoolImportReconcileBtn');
    if (button) button.disabled = true;
    try {
        const result = await API.reconcileSchoolImport(batchId);
        await loadSchoolImportReview(batchId, {
            classId: state.schoolImport?.selectedClassId || null,
            summary: result.summary || null,
            readyToImport: result.ready_to_import === true,
            clearSelection: false,
        });
        ui.toast(result.ready_to_import ? t('school_import_reconciled_ready') : t('school_import_reconciled_blocked'));
    } catch (error) {
        ui.toast(error.message || t('school_import_reconcile_error'), true);
    } finally {
        const current = document.querySelector('#schoolImportReconcileBtn');
        if (current && state.schoolImport?.batch?.status !== 'imported') current.disabled = false;
    }
}

function openSchoolImportCommitDialog() {
    const data = state.schoolImport;
    if (!data?.batch || data.ready_to_import !== true || data.batch.status === 'imported') return;

    const dialog = document.querySelector('#schoolImportCommitDialog');
    const summary = document.querySelector('#schoolImportCommitSummary');
    const checkbox = document.querySelector('#schoolImportReviewedInput');
    const confirm = document.querySelector('#schoolImportCommitConfirmBtn');
    if (!dialog || !summary || !checkbox || !confirm) return;

    const values = data.summary || {};
    summary.innerHTML = '<p><strong>' + esc(data.batch.original_filename) + '</strong></p>'
        + '<p>' + esc(t('school_import_commit_summary')) + '</p>'
        + '<dl class="school-import-confirm-grid">'
        + '<div><dt>' + esc(t('classes')) + '</dt><dd>' + Number(values.class_count || data.batch.total_classes || 0) + '</dd></div>'
        + '<div><dt>' + esc(t('students')) + '</dt><dd>' + Number(values.student_count || data.batch.total_rows || 0) + '</dd></div>'
        + '<div><dt>' + esc(t('school_import_new')) + '</dt><dd>' + Number(values.new_students || 0) + '</dd></div>'
        + '<div><dt>' + esc(t('school_import_existing')) + '</dt><dd>' + Number(values.existing_students || 0) + '</dd></div>'
        + '<div><dt>' + esc(t('school_import_conflicts')) + '</dt><dd>' + Number(values.conflict_rows || 0) + '</dd></div>'
        + '</dl>';
    checkbox.checked = false;
    confirm.disabled = true;
    dialog.showModal();
}

async function commitSchoolImport() {
    const data = state.schoolImport;
    if (!data?.batch) return;

    const confirm = document.querySelector('#schoolImportCommitConfirmBtn');
    if (confirm) confirm.disabled = true;

    try {
        const result = await API.commitSchoolImport(Number(data.batch.id));
        document.querySelector('#schoolImportCommitDialog')?.close();
        await loadSchoolImportReview(Number(data.batch.id), {
            summary: result.summary || null,
            readyToImport: false,
            clearSelection: false,
        });
        ui.toast(t('school_import_committed'));
        await loadAdmin();
        if (state.classId) await loadClass();
    } catch (error) {
        ui.toast(error.message || t('school_import_commit_error'), true);
        if (confirm) confirm.disabled = false;
    }
}

function wire() {
    document.querySelector('#reloadBtn')?.addEventListener('click', loadClass);
    document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
        try {
            if (!await flushAttendanceQueue()) return;
            await API.logout();
            window.location.href = 'login.php';
        } catch (error) {
            ui.toast(error.message || t('logout_error'), true);
        }
    });

    document.querySelector('#themeBtn')?.addEventListener('click', () => {
        document.body.classList.toggle('light');
        localStorage.setItem('sams-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    });
    if (localStorage.getItem('sams-theme') === 'light') document.body.classList.add('light');

    document.querySelector('#classSelect')?.addEventListener('change', async (event) => {
        if (!await flushAttendanceQueue()) return;
        setState({ classId: Number(event.target.value) });
        await loadClass();
        if (state.user?.role === 'admin') await loadAdmin();
        if (state.tab === 'archive') await loadArchive(state.archiveView || 'days');
    });

    document.querySelector('#monthSelect')?.addEventListener('change', async (event) => {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) return;
        setState({ month: event.target.value });
        await loadClass();
    });

    document.querySelector('#studentSearch')?.addEventListener('input', (event) => {
        setState({ search: event.target.value });
        ui.attendance();
    });

    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        setState({ filter: button.dataset.filter || 'all' });
        ui.attendance();
    }));

    document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', async () => {
        if (!await flushAttendanceQueue()) return;
        document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.tab));
        setState({ tab: button.dataset.tab });

        if (button.dataset.tab === 'archive') await loadArchive('days');
        if (button.dataset.tab === 'teachers') await loadTeachers();
        if (button.dataset.tab === 'admin') await loadAdmin();
        restartAdminRefresh();
    }));

    document.querySelector('#refreshDashboardBtn')?.addEventListener('click', async () => {
        await loadAdmin();
        ui.toast(t('refresh'));
    });

    document.querySelector('#teacherSearch')?.addEventListener('input', () => ui.teachers());
    document.querySelector('#teacherStatusFilter')?.addEventListener('change', () => ui.teachers());
    document.querySelector('#teacherSubjectFilter')?.addEventListener('change', () => ui.teachers());
    document.querySelector('#teacherClassFilter')?.addEventListener('change', () => ui.teachers());

    document.querySelector('#addSubjectBtn')?.addEventListener('click', () => document.querySelector('#subjectDialog')?.showModal());
    document.querySelector('#assignTeachingBtn')?.addEventListener('click', () => {
        document.querySelector('#teachingTeacherId').value = '';
        document.querySelector('#teachingSubjectId').value = '';
        document.querySelector('#teachingClassId').value = '';
        ui.teachers();
        document.querySelector('#teachingDialog')?.showModal();
    });

    document.querySelector('#teacherEditForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = Number(document.querySelector('#teacherEditId')?.value || 0);
        const teacher = state.teachers.find((item) => Number(item.id) === id);
        if (!teacher) return;
        try {
            await API.updateUser(id, {
                full_name: document.querySelector('#teacherEditFullName').value.trim(),
                role: 'teacher',
                is_active: document.querySelector('#teacherEditActive').value === '1',
                employee_id: document.querySelector('#teacherEditEmployeeId').value.trim(),
                phone: document.querySelector('#teacherEditPhone').value.trim() || null,
            });
            document.querySelector('#teacherEditDialog')?.close();
            await loadTeachers();
            ui.toast(t('save'));
        } catch (error) {
            ui.toast(error.message || t('modify_error'), true);
        }
    });

    document.querySelector('#teachingForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await API.assignTeaching(
                Number(document.querySelector('#teachingTeacherId').value),
                Number(document.querySelector('#teachingSubjectId').value),
                Number(document.querySelector('#teachingClassId').value)
            );
            document.querySelector('#teachingDialog')?.close();
            await loadTeachers();
            ui.toast(t('assign'));
        } catch (error) {
            ui.toast(error.message || t('assignment_error'), true);
        }
    });

    document.querySelector('#subjectForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await API.createSubject({
                code: document.querySelector('#subjectCodeInput').value.trim(),
                name_fr: document.querySelector('#subjectNameFrInput').value.trim(),
                name_ar: document.querySelector('#subjectNameArInput').value.trim(),
                name_en: document.querySelector('#subjectNameEnInput').value.trim(),
            });
            document.querySelector('#subjectDialog')?.close();
            form.reset();
            await loadTeachers();
            ui.toast(t('create'));
        } catch (error) {
            ui.toast(error.message || t('subject_create_error'), true);
        }
    });

    document.querySelector('#teachersList')?.addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-edit-teacher]');
        const assign = event.target.closest('[data-assign-teacher]');
        const remove = event.target.closest('[data-unassign-teaching]');
        try {
            if (edit) {
                const teacher = state.teachers.find((item) => Number(item.id) === Number(edit.dataset.editTeacher));
                if (!teacher) return;
                document.querySelector('#teacherEditId').value = String(teacher.id);
                document.querySelector('#teacherEditEmployeeId').value = teacher.employee_id || teacher.username || '';
                document.querySelector('#teacherEditFullName').value = teacher.full_name || '';
                document.querySelector('#teacherEditPhone').value = teacher.phone || '';
                document.querySelector('#teacherEditActive').value = Number(teacher.is_active) === 1 ? '1' : '0';
                document.querySelector('#teacherEditDialog')?.showModal();
                return;
            }
            if (assign) {
                document.querySelector('#teachingTeacherId').value = String(assign.dataset.assignTeacher || '');
                document.querySelector('#teachingSubjectId').value = '';
                document.querySelector('#teachingClassId').value = '';
                document.querySelector('#teachingDialog')?.showModal();
                return;
            }
            if (remove) {
                if (!window.confirm(t('remove') + '?')) return;
                await API.unassignTeaching(Number(remove.dataset.unassignTeaching));
                await loadTeachers();
            }
        } catch (error) {
            ui.toast(error.message || t('teacher_manage_error'), true);
        }
    });

    const handleAttendanceAction = (event) => {
        const button = event.target.closest('[data-attendance-toggle]');
        if (!button || button.disabled) return;
        queueAttendanceToggle(Number(button.dataset.student));
    };

    document.querySelector('#attendanceMobileList')?.addEventListener('click', handleAttendanceAction);
    document.querySelector('#attendanceBody')?.addEventListener('click', handleAttendanceAction);

    document.querySelector('#attendanceWorkflow')?.addEventListener('click', async (event) => {
        if (event.target.closest('[data-sign-period]')) await signSelectedLesson();
        if (event.target.closest('[data-reopen-period]')) await reopenSelectedLesson();
    });

    document.querySelector('#weeklyTeacherSignatures')?.addEventListener('click', async (event) => {
        if (event.target.closest('[data-sign-week]')) await signSelectedWeek();
        if (event.target.closest('[data-receive-week]')) await receiveSelectedWeek();
    });

    document.querySelector('#weekDays')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-select-day]');
        if (!button) return;
        setState({ selectedDay: button.dataset.selectDay });
        ui.attendance();
    });

    document.querySelector('#periods')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-select-period]');
        if (!button) return;
        setState({ selectedPeriod: Number(button.dataset.selectPeriod) });
        ui.attendance();
    });

    document.querySelector('#prevWeekBtn')?.addEventListener('click', () => shiftWeek(-1));
    document.querySelector('#nextWeekBtn')?.addEventListener('click', () => shiftWeek(1));
    document.querySelector('#weekStart')?.addEventListener('change', () => {
        const value = document.querySelector('#weekStart')?.value || '';
        if (!value) return;
        const normalized = startOfWeek(value);
        setState({ weekStart: normalized, selectedDay: normalized });
        document.querySelector('#weekStart').value = normalized;
        loadClass();
    });

    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => {
        document.querySelector(`#${button.dataset.closeDialog}`)?.close();
    }));

    document.querySelector('#addStudentBtn')?.addEventListener('click', () => document.querySelector('#studentDialog')?.showModal());
    document.querySelector('#studentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await API.createStudent(state.classId, {
                first_name: document.querySelector('#firstNameInput').value.trim(),
                last_name: document.querySelector('#lastNameInput').value.trim(),
                massar_code: document.querySelector('#massarInput').value.trim() || null,
                birth_date: document.querySelector('#birthDateInput').value || null,
                student_number: document.querySelector('#studentNumberInput').value.trim() || null,
            });
            form.closest('dialog')?.close();
            form.reset();
            await loadClass();
            ui.toast(t('student_added'));
        } catch (error) { ui.toast(error.message || t('app_error'), true); }
    });

    document.querySelector('#studentsList')?.addEventListener('click', async (event) => {
        const transferButton = event.target.closest('[data-transfer-student]');
        const editButton = event.target.closest('[data-edit-student]');
        const deleteButton = event.target.closest('[data-delete-student]');
        if (!state.classId) return;

        if (transferButton) {
            if (state.user?.role !== 'admin') return;
            const studentId = Number(transferButton.dataset.transferStudent);
            const student = state.students.find((item) => Number(item.id) === studentId);
            if (!student) return;

            const target = document.querySelector('#transferTargetClassInput');
            if (!target || target.options.length === 0) {
                ui.toast(t('no_target_class'), true);
                return;
            }

            document.querySelector('#transferStudentId').value = String(studentId);
            target.value = target.options[0].value;

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.querySelector('#transferEffectiveDateInput').value = tomorrow.toISOString().slice(0, 10);

            document.querySelector('#transferStudentDialog')?.showModal();
            return;
        }

        if (editButton) {
            const student = state.students.find((item) => Number(item.id) === Number(editButton.dataset.editStudent));
            if (!student) return;
            document.querySelector('#editStudentId').value = String(student.id);
            document.querySelector('#editFirstNameInput').value = student.first_name || '';
            document.querySelector('#editLastNameInput').value = student.last_name || '';
            document.querySelector('#editMassarInput').value = student.massar_code || '';
            document.querySelector('#editBirthDateInput').value = student.birth_date || '';
            document.querySelector('#editStudentNumberInput').value = student.student_number || '';
            document.querySelector('#editStudentDialog')?.showModal();
            return;
        }

        if (!deleteButton) return;
        if (!window.confirm(t('deactivate_student_confirm'))) return;
        try {
            await API.deleteStudent(state.classId, Number(deleteButton.dataset.deleteStudent));
            await loadClass();
            ui.toast(t('student_disabled'));
        } catch (error) { ui.toast(error.message || t('app_error'), true); }
    });

    document.querySelector('#editStudentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!state.classId) return;
        const form = event.currentTarget;
        try {
            await API.updateStudent(state.classId, Number(document.querySelector('#editStudentId').value), {
                first_name: document.querySelector('#editFirstNameInput').value.trim(),
                last_name: document.querySelector('#editLastNameInput').value.trim(),
                massar_code: document.querySelector('#editMassarInput').value.trim() || null,
                birth_date: document.querySelector('#editBirthDateInput').value || null,
                student_number: document.querySelector('#editStudentNumberInput').value.trim() || null,
            });
            form.closest('dialog')?.close();
            await loadClass();
            ui.toast(t('student_updated'));
        } catch (error) {
            ui.toast(error.message || t('modify_error'), true);
        }
    });

    document.querySelector('#addClassBtn')?.addEventListener('click', () => document.querySelector('#classDialog')?.showModal());
    document.querySelector('#classForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await API.createClass({
                name: document.querySelector('#classNameInput').value.trim(),
                level: document.querySelector('#classLevelInput').value.trim(),
                branch: document.querySelector('#classBranchInput').value.trim(),
            });
            document.querySelector('#classDialog')?.close();
            form.reset();
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            ui.classes();
            ui.toast(t('class_created'));
        } catch (error) { ui.toast(error.message || t('app_error'), true); }
    });

    document.querySelector('#reportBtn')?.addEventListener('click', printWeeklyAttendance);
    document.querySelector('#annualReportBtn')?.addEventListener('click', () => { document.querySelector('#reportDialog')?.close(); openAnnualReport(); });

    document.querySelector('#loadArchiveBtn')?.addEventListener('click', () => loadArchive(state.archiveView || 'days'));
    document.querySelectorAll('[data-archive-view]').forEach((button) => button.addEventListener('click', async () => {
        document.querySelectorAll('[data-archive-view]').forEach((item) => item.classList.toggle('active', item === button));
        await loadArchive(button.dataset.archiveView || 'days');
    }));
    document.querySelector('#archiveTable')?.addEventListener('click', async (event) => {
        const dayButton = event.target.closest('[data-archive-day]');
        const historyButton = event.target.closest('[data-student-history]');
        try {
            if (dayButton) {
                await openArchiveDay(dayButton.dataset.archiveDay);
                return;
            }
            if (historyButton) {
                await openStudentHistory(Number(historyButton.dataset.studentHistory));
            }
        } catch (error) {
            ui.toast(error.message || t('archive_load_error'), true);
        }
    });

    const archiveMonth = document.querySelector('#archiveMonth');
    if (archiveMonth) archiveMonth.value = state.month;

    document.querySelector('#editClassForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const classId = Number(document.querySelector('#editClassId').value);
        try {
            await API.updateClass(classId, {
                name: document.querySelector('#editClassNameInput').value.trim(),
                level: document.querySelector('#editClassLevelInput').value.trim(),
                branch: document.querySelector('#editClassBranchInput').value.trim(),
            });
            document.querySelector('#editClassDialog')?.close();
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            await loadAdmin();
            renderAll();
            if (state.classId) await loadClass();
            ui.toast(t('class_updated'));
        } catch (error) {
            ui.toast(error.message || t('class_modify_error'), true);
        }
    });

    document.querySelector('#editUserForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = Number(document.querySelector('#editUserId').value);
        try {
            await API.updateUser(userId, {
                full_name: document.querySelector('#editUserFullNameInput').value.trim(),
                role: document.querySelector('#editUserRoleInput').value,
                is_active: document.querySelector('#editUserActiveInput').value === '1',
            });
            document.querySelector('#editUserDialog')?.close();
            await loadAdmin();
            ui.toast(t('user_updated'));
        } catch (error) {
            ui.toast(error.message || t('user_modify_error'), true);
        }
    });

    document.querySelector('#resetUserPasswordForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const userId = Number(document.querySelector('#resetUserId').value);
        const password = document.querySelector('#resetUserPasswordInput').value;
        try {
            await API.resetUserPassword(userId, password);
            form.reset();
            document.querySelector('#resetUserPasswordDialog')?.close();
            await loadAdmin();
            ui.toast(t('password_reset'));
        } catch (error) {
            ui.toast(error.message || t('password_reset_error'), true);
        }
    });

    document.querySelector('#userForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await API.createUser({
                username: document.querySelector('#userUsernameInput').value.trim(),
                full_name: document.querySelector('#userFullNameInput').value.trim(),
                role: document.querySelector('#userRoleInput').value,
                password: document.querySelector('#userPasswordInput').value,
            });
            form.reset();
            await loadAdmin();
            ui.toast(t('user_created'));
        } catch (error) {
            ui.toast(error.message || t('user_create_error_runtime'), true);
        }
    });

    document.querySelector('#academicYearForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await API.createAcademicYear({
                name: document.querySelector('#academicYearNameInput').value.trim(),
                starts_on: document.querySelector('#academicYearStartInput').value,
                ends_on: document.querySelector('#academicYearEndInput').value,
                activate: document.querySelector('#academicYearActivateInput').value === '1',
            });
            form.reset();
            await loadAdmin();
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            renderAll();
            if (state.classId) await loadClass();
            ui.toast(t('year_created'));
        } catch (error) {
            ui.toast(error.message || t('academic_year_error_runtime'), true);
        }
    });

    document.querySelector('#assignmentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const teacherId = Number(document.querySelector('#assignmentTeacherInput').value);
        const classId = Number(document.querySelector('#assignmentClassInput').value);
        try {
            await API.assignTeacher(teacherId, classId);
            await loadAdmin();
            ui.toast(t('assignment_saved'));
        } catch (error) {
            ui.toast(error.message || t('assignment_error'), true);
        }
    });

    document.querySelector('#transferStudentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!state.classId || state.user?.role !== 'admin') return;

        const studentId = Number(document.querySelector('#transferStudentId').value);
        const targetClassId = Number(document.querySelector('#transferTargetClassInput').value);
        const effectiveDate = document.querySelector('#transferEffectiveDateInput').value;

        try {
            await API.transferStudent(state.classId, studentId, targetClassId, effectiveDate);
            document.querySelector('#transferStudentDialog')?.close();
            await loadClass();
            await loadAdmin();
            ui.toast(t('transfer_done'));
        } catch (error) {
            ui.toast(error.message || t('transfer_error'), true);
        }
    });

    document.querySelector('#userForm')?.addEventListener('reset', () => {
        const password = document.querySelector('#userPasswordInput');
        if (password) password.value = '';
    });

    document.querySelector('#importForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!state.classId) return ui.toast(t('select_class'), true);
        const file = document.querySelector('#studentImportFile')?.files?.[0];
        if (!file) return ui.toast(t('select_csv'), true);
        try {
            const result = await API.stageImport(state.classId, file);
            await loadAdmin();
            ui.toast(`${t('import_created').replace('%id%', result.batch_id)}`);
        } catch (error) {
            ui.toast(error.message || t('error_import'), true);
        }
    });

    document.querySelector('#schoolImportForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = document.querySelector('#schoolImportFile')?.files?.[0];
        const academicYearId = Number(document.querySelector('#schoolImportAcademicYearInput')?.value || 0);
        if (!file) return ui.toast(t('school_import_select_file'), true);
        if (!academicYearId) return ui.toast(t('school_import_select_year'), true);

        const uploadButton = document.querySelector('#schoolImportUploadBtn');
        if (uploadButton) uploadButton.disabled = true;
        try {
            const result = await API.stageSchoolImport(academicYearId, file);
            await loadSchoolImportReview(Number(result.batch_id), {
                summary: null,
                readyToImport: false,
                clearSelection: true,
            });
            ui.toast(t('school_import_staged'));
            document.querySelector('#schoolImportFile').value = '';
        } catch (error) {
            ui.toast(error.message || t('school_import_upload_error'), true);
        } finally {
            const button = document.querySelector('#schoolImportUploadBtn');
            if (button) button.disabled = false;
        }
    });

    document.querySelector('#schoolImportReview')?.addEventListener('click', async (event) => {
        const classButton = event.target.closest('[data-school-import-class]');
        const reconcileButton = event.target.closest('#schoolImportReconcileBtn');
        const commitButton = event.target.closest('#schoolImportCommitBtn');

        if (classButton) {
            const batchId = Number(state.schoolImport?.batch?.id || 0);
            const classId = Number(classButton.dataset.schoolImportClass || 0);
            if (batchId && classId) await loadSchoolImportReview(batchId, { classId });
            return;
        }

        if (reconcileButton && !reconcileButton.disabled) {
            await reconcileSchoolImport(Number(state.schoolImport?.batch?.id || 0));
            return;
        }

        if (commitButton && !commitButton.disabled) {
            openSchoolImportCommitDialog();
        }
    });

    document.querySelector('#schoolImportReviewedInput')?.addEventListener('change', (event) => {
        const confirm = document.querySelector('#schoolImportCommitConfirmBtn');
        if (confirm) confirm.disabled = !event.target.checked;
    });

    document.querySelector('#schoolImportCommitConfirmBtn')?.addEventListener('click', async () => {
        await commitSchoolImport();
    });

    document.querySelector('#adminClassesTable')?.addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-edit-class]');
        const toggle = event.target.closest('[data-toggle-class]');
        try {
            if (edit) {
                const item = state.adminClasses.find((cls) => Number(cls.id) === Number(edit.dataset.editClass));
                if (!item) return;
                document.querySelector('#editClassId').value = String(item.id);
                document.querySelector('#editClassNameInput').value = item.name || '';
                document.querySelector('#editClassLevelInput').value = item.level || '';
                document.querySelector('#editClassBranchInput').value = item.branch || '';
                document.querySelector('#editClassDialog')?.showModal();
                return;
            }
            if (toggle) {
                const id = Number(toggle.dataset.toggleClass);
                const active = toggle.dataset.active !== '1';
                if (!window.confirm(active ? t('activate_class_confirm') : t('deactivate_class_confirm'))) return;
                await API.setClassActive(id, active);
                const classes = await API.classes();
                setOperationalClasses(classes.classes || []);
                await loadAdmin();
                renderAll();
                if (state.classId) await loadClass();
                ui.toast(active ? t('class_activated') : t('class_deactivated'));
            }
        } catch (error) {
            ui.toast(error.message || t('class_error'), true);
        }
    });

    document.querySelector('#usersTable')?.addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-edit-user]');
        const reset = event.target.closest('[data-reset-user]');
        const unlock = event.target.closest('[data-unlock-user]');
        const toggle = event.target.closest('[data-toggle-user]');
        try {
            if (edit) {
                const user = state.users.find((item) => Number(item.id) === Number(edit.dataset.editUser));
                if (!user) return;
                document.querySelector('#editUserId').value = String(user.id);
                document.querySelector('#editUserFullNameInput').value = user.full_name || '';
                document.querySelector('#editUserRoleInput').value = user.role || 'teacher';
                document.querySelector('#editUserActiveInput').value = Number(user.is_active) === 1 ? '1' : '0';
                document.querySelector('#editUserDialog')?.showModal();
                return;
            }
            if (reset) {
                document.querySelector('#resetUserId').value = String(reset.dataset.resetUser);
                document.querySelector('#resetUserPasswordInput').value = '';
                document.querySelector('#resetUserPasswordDialog')?.showModal();
                return;
            }
            if (unlock) {
                await API.unlockUser(Number(unlock.dataset.unlockUser));
                await loadAdmin();
                ui.toast(t('account_unlocked'));
                return;
            }
            if (toggle) {
                const id = Number(toggle.dataset.toggleUser);
                const current = state.users.find((user) => Number(user.id) === id);
                if (!current) return;
                await API.updateUser(id, {
                    full_name: current.full_name,
                    role: current.role,
                    is_active: Number(toggle.dataset.active) !== 1,
                });
                await loadAdmin();
            }
        } catch (error) {
            ui.toast(error.message || t('account_error'), true);
        }
    });

    document.querySelector('#assignmentsTable')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-unassign-teacher]');
        if (!button || !state.classId) return;
        try {
            await API.unassignTeacher(Number(button.dataset.unassignTeacher), state.classId);
            await loadAdmin();
            ui.toast(t('assignment_removed'));
        } catch (error) {
            ui.toast(error.message || t('unassign_error'), true);
        }
    });

    document.querySelector('#academicYearsTable')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-activate-year]');
        if (!button) return;
        try {
            await API.activateAcademicYear(Number(button.dataset.activateYear));
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            await loadAdmin();
            renderAll();
            if (state.classId) await loadClass();
            ui.toast(t('year_activated'));
        } catch (error) {
            ui.toast(error.message || t('activate_year_error'), true);
        }
    });

    document.querySelector('#importsTable')?.addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-edit-import]');
        const revalidate = event.target.closest('[data-revalidate-import]');
        const runImport = event.target.closest('[data-run-import]');
        try {
            if (edit) {
                await openImportCorrection(Number(edit.dataset.editImport));
                return;
            }
            if (revalidate) {
                await API.revalidateImport(Number(revalidate.dataset.revalidateImport));
                await loadAdmin();
                ui.toast(t('import_revalidated'));
                return;
            }
            if (runImport && !runImport.disabled) {
                if (!window.confirm(t('import_confirm'))) return;
                await API.runImport(Number(runImport.dataset.runImport));
                await loadClass();
                await loadAdmin();
                ui.toast(t('import_finished'));
            }
        } catch (error) {
            ui.toast(error.message || t('error_import'), true);
        }
    });

    document.addEventListener('click', (event) => {
        const close = event.target.closest('[data-close-dialog]');
        if (!close) return;
        document.querySelector('#' + close.dataset.closeDialog)?.close();
    });

    document.querySelector('#importCorrectionForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const dialog = document.querySelector('#importCorrectionDialog');
        const batchId = Number(dialog?.dataset.batchId || 0);
        if (!batchId) return;

        try {
            const rows = [...document.querySelectorAll('#importCorrectionRows .import-correction-row')];
            for (const row of rows) {
                const data = {};
                row.querySelectorAll('input[name]').forEach((input) => {
                    data[input.name] = input.value.trim();
                });
                await API.correctImportRow(batchId, Number(row.dataset.rowId), data);
            }
            dialog?.close();
            await API.revalidateImport(batchId);
            await loadAdmin();
            ui.toast(t('corrections_saved'));
        } catch (error) {
            ui.toast(error.message || t('import_correction_error'), true);
        }
    });

    setupSignature({
        canvas: document.querySelector('#signatureCanvas'),
        clearButton: document.querySelector('#clearSignatureBtn'),
        saveButton: document.querySelector('#saveSignatureBtn'),
    });
}

async function loadSignature() {
    if (!state.classId) return;
    try {
        const result = await API.signature(state.classId);
        window.dispatchEvent(new CustomEvent('sams:signature-load', { detail: result.signature?.signature_data || '' }));
    } catch (error) {
        ui.toast(error.message || t('signature_load_error'), true);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('sams:language', () => renderAll());
    ensureArchiveDynamicUI();
    ensureAdminDynamicUI();
    wire();
    boot();
});
