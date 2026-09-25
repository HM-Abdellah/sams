import { API, setCsrf, getCsrf } from './api.js';
import { state, setState } from './state.js';
import { ui, renderAll } from './ui.js';
import { setupSignature } from './signature.js';
import { DAYS, PERIODS, dateFromWeek, startOfWeek, attendanceKey, displayName } from './logic.js';
import { initLanguage, t } from './i18n.js';

let loading = false;
let clickTimer = null;
let attendanceFlushTimer = null;
let attendanceFlushPromise = null;
let adminRefreshTimer = null;
let presenceTimer = null;
let attendanceVersion = 0;
const pendingAttendance = new Map();

function currentMonth() {
    return state.month || new Date().toISOString().slice(0, 7);
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
        const [students, attendance] = await Promise.all([
            API.students(state.classId),
            API.attendanceWeek(state.classId, state.weekStart),
        ]);
        setState({
            students: students.students || [],
            attendance: attendance.attendance || [],
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
        const defaultWeekStart = startOfWeek(new Date().toISOString().slice(0, 10));
        setState({
            user: session.user,
            csrf: session.csrf || '',
            month,
            weekStart: state.weekStart || defaultWeekStart,
            selectedDay: state.selectedDay || defaultWeekStart,
            selectedPeriod: state.selectedPeriod || 1,
        });
        initLanguage();
        await startPresenceHeartbeat();

        const classes = await API.classes();
        const list = Array.isArray(classes.classes) ? classes.classes : [];
        setOperationalClasses(list);

        const weekInput = document.querySelector('#weekStart');
        if (weekInput) weekInput.value = state.weekStart;

        const currentUser = document.querySelector('#currentUser');
        if (currentUser && state.user) currentUser.textContent = `${state.user.full_name} · ${state.user.role}`;

        if (state.user?.role !== 'admin') document.querySelectorAll('.admin-only').forEach((el) => el.remove());
        ensureArchiveDynamicUI();
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
            if (!students.has(id)) {
                students.set(id, {
                    name: displayStudentName(row),
                    massar: row.massar_code || '—',
                    periods: new Map()
                });
            }
            if (row.period != null && row.status) {
                students.get(id).periods.set(Number(row.period), row.status);
            }
        }

        const periodLabel = (period) => [
            '08:00–09:00','09:00–10:00','10:00–11:00','11:00–12:00',
            '14:00–15:00','15:00–16:00','16:00–17:00','17:00–18:00'
        ][period - 1] || String(period);

        content.innerHTML = '<p><strong>' + esc(result.class?.name || '') + '</strong> · ' + esc(date) + '</p>'
            + (students.size
                ? '<div class="table-scroll"><table><thead><tr><th>Élève</th><th>Massar</th>' +
                    Array.from({length:8}, (_, i) => '<th>' + (i + 1) + '</th>').join('') +
                    '</tr></thead><tbody>' +
                    [...students.values()].map((student) =>
                        '<tr><td>' + esc(student.name) + '</td><td>' + esc(student.massar) + '</td>' +
                        Array.from({length:8}, (_, i) => {
                            const status = student.periods.get(i + 1) || '';
                            const label = status === 'present' ? '✓'
                                : status === 'absent' ? '✕'
                                : status === 'late' ? 'L'
                                : status === 'excused' ? 'E'
                                : '·';
                            return '<td title="' + esc(periodLabel(i + 1)) + '">' + label + '</td>';
                        }).join('') +
                        '</tr>'
                    ).join('') +
                    '</tbody></table></div>'
                : '<p class="empty-state">Aucun enregistrement pour cette date.</p>');
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || 'Impossible de charger la journée.', true);
    }
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
            + ' · Massar: ' + esc(first?.massar_code || '—')
            + ' · Classe: ' + esc(result.class?.name || first?.class_name || '—') + '</p>'
            + '<div class="table-scroll"><table><thead><tr><th>Date</th><th>Période</th><th>Statut</th></tr></thead><tbody>'
            + (attendanceRows.map((row) =>
                '<tr><td>' + esc(row.attendance_date) + '</td><td>' + Number(row.period) + '</td><td>' + esc(row.status) + '</td></tr>'
            ).join('') || '<tr><td colspan="3" class="empty-state">Aucune présence enregistrée.</td></tr>')
            + '</tbody></table></div>';
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || 'Impossible de charger l’historique.', true);
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
            + '<label><span data-i18n="role">Rôle</span><select id="editUserRoleInput"><option value="teacher">teacher</option><option value="counselor">counselor</option><option value="admin">admin</option></select></label>'
            + '<label><span data-i18n="active">Actif</span><select id="editUserActiveInput"><option value="1">Oui</option><option value="0">Non</option></select></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editUserDialog">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>'
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
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="transferStudentDialog" data-i18n="cancel">Annuler</button><button class="btn primary" type="submit">Transférer</button></div>'
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
        ui.toast(error.message || 'Erreur de chargement administration.', true);
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
        ui.toast(error.message || 'Erreur de chargement des enseignants.', true);
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
        ui.toast(error.message || 'Erreur de chargement archive.', true);
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
                } catch (error) {
                    for (const [key, entry] of batch) {
                        const current = pendingAttendance.get(key);
                        if (current && current.version !== entry.version) continue;

                        setLocalAttendanceStatus(entry, entry.previousStatus || '');
                    }

                    ui.attendance();
                    ui.stats();
                    ui.statistics();
                    ui.toast(error.message || 'Échec de sauvegarde.', true);
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

function queueAttendanceStatus(studentId, status) {
    const date = state.selectedDay || state.weekStart;
    const period = Number(state.selectedPeriod || 1);
    if (!state.classId || !date || !studentId) return;
    const payload = { student_id: Number(studentId), attendance_date: date, period };
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
    ui.attendance();
    ui.stats();
    ui.statistics();
    scheduleAttendanceFlush();
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
    const map = new Map(state.attendance.map((row) => [attendanceKey(row.student_id, row.attendance_date, Number(row.period)), row.status]));
    const mark = (status) => ({ present:'P', absent:'A', late:'R', excused:'E' }[status] || '·');
    const dayHeaders = DAYS.map((_, dayIndex) => {
        const date = dateFromWeek(start, dayIndex);
        const value = new Date(date + 'T00:00:00Z');
        const label = value.toLocaleDateString(stateLanguageLocale(), { weekday:'short', day:'2-digit', month:'2-digit', timeZone:'UTC' });
        return '<th class="print-day" colspan="8"><strong>' + esc(label) + '</strong><small>1 · 2 · 3 · 4 · 5 · 6 · 7 · 8</small></th>';
    }).join('');
    const rows = state.students.map((student, index) => {
        let absent = 0; let late = 0; let excused = 0;
        const dayCells = DAYS.map((_, dayIndex) => {
            const date = dateFromWeek(start, dayIndex);
            const marks = PERIODS.map((_, periodIndex) => {
                const status = map.get(attendanceKey(student.id, date, periodIndex + 1)) || '';
                if (status === 'absent') absent += 1;
                if (status === 'late') late += 1;
                if (status === 'excused') excused += 1;
                return '<span>' + mark(status) + '</span>';
            }).join('');
            return '<td class="print-day-cell">' + marks + '</td>';
        }).join('');
        return '<tr><td>' + (index + 1) + '</td><td class="print-name">' + esc(displayName(student)) + '</td><td>' + esc(student.student_number || '') + '</td>' + dayCells + '<td>' + absent + '</td><td>' + late + '</td><td>' + excused + '</td></tr>';
    }).join('');
    sheet.innerHTML = '<div class="print-header"><div><h1>' + esc(t('weekly_attendance')) + '</h1><p>' + esc(t('official_school_record')) + '</p></div>'
        + '<div class="print-meta"><div><strong>' + esc(t('class')) + ':</strong> ' + esc(currentClass.name || '—') + '</div>'
        + '<div><strong>' + esc(t('branch')) + ':</strong> ' + esc(currentClass.branch || '—') + '</div>'
        + '<div><strong>' + esc(t('level')) + ':</strong> ' + esc(currentClass.level || '—') + '</div>'
        + '<div><strong>' + esc(t('academic_year')) + ':</strong> ' + esc(currentClass.academic_year_name || '—') + '</div>'
        + '<div><strong>' + esc(t('week')) + ':</strong> ' + esc(start) + ' → ' + esc(end) + '</div></div></div>'
        + '<table class="print-attendance-table"><thead><tr><th rowspan="2">#</th><th rowspan="2">' + esc(t('student')) + '</th><th rowspan="2">' + esc(t('student_number_short')) + '</th>' + dayHeaders
        + '<th rowspan="2">' + esc(t('absence_short')) + '</th><th rowspan="2">' + esc(t('late_short')) + '</th><th rowspan="2">' + esc(t('excused_short')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>'
        + '<div class="print-legend"><span><strong>P</strong> ' + esc(t('present')) + '</span><span><strong>A</strong> ' + esc(t('absent')) + '</span><span><strong>R</strong> ' + esc(t('late')) + '</span><span><strong>E</strong> ' + esc(t('excused')) + '</span><span>· ' + esc(t('not_marked')) + '</span></div>'
        + '<div class="print-signatures"><div>' + esc(t('teacher_signature')) + '<span></span></div><div>' + esc(t('administration_signature')) + '<span></span></div></div>';
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
            return `<tr><td>${index + 1}</td><td>${esc(`${student.first_name} ${student.last_name}`)}</td><td>${student.present_count}</td><td>${student.absent_count}</td><td>${student.other_count}</td><td>${rate}%</td></tr>`;
        }).join('');

        const win = window.open('', '_blank');
        if (!win) throw new Error('Le navigateur a bloqué la fenêtre du rapport.');
        win.document.write(`<!doctype html><html lang="fr" dir="rtl"><head><meta charset="utf-8"><title>SAMS — Statistiques</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#111}h1{text-align:center}p{text-align:center;color:#555}table{width:100%;border-collapse:collapse;margin-top:2rem}th,td{border:1px solid #aaa;padding:.55rem;text-align:center}th{background:#eee}@media print{@page{size:A4 portrait;margin:12mm}}</style></head><body><h1>SAMS — Statistiques analytiques</h1><p>${esc(report.class?.name || '')} · ${esc(report.month || currentMonth())}</p><table><thead><tr><th>#</th><th>Élève</th><th>Présences</th><th>Absences</th><th>Autres</th><th>Taux</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
        win.document.close();
    } catch (error) {
        ui.toast(error.message || 'Impossible de générer le rapport.', true);
    }
}

function esc(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
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
            ui.toast(error.message || 'Erreur de modification.', true);
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
            ui.toast(error.message || 'Erreur d’affectation.', true);
        }
    });

    document.querySelector('#subjectForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await API.createSubject({
                code: document.querySelector('#subjectCodeInput').value.trim(),
                name_fr: document.querySelector('#subjectNameFrInput').value.trim(),
                name_ar: document.querySelector('#subjectNameArInput').value.trim(),
                name_en: document.querySelector('#subjectNameEnInput').value.trim(),
            });
            document.querySelector('#subjectDialog')?.close();
            event.currentTarget.reset();
            await loadTeachers();
            ui.toast(t('create'));
        } catch (error) {
            ui.toast(error.message || 'Erreur de création de matière.', true);
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
            ui.toast(error.message || 'Erreur de gestion enseignant.', true);
        }
    });

    const handleAttendanceAction = (event) => {
        const button = event.target.closest('[data-attendance-status]');
        if (!button) return;
        queueAttendanceStatus(Number(button.dataset.student), button.dataset.attendanceStatus || '');
    };

    document.querySelector('#attendanceMobileList')?.addEventListener('click', handleAttendanceAction);
    document.querySelector('#attendanceBody')?.addEventListener('click', handleAttendanceAction);

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
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
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
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
    });

    document.querySelector('#editStudentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!state.classId) return;
        try {
            await API.updateStudent(state.classId, Number(document.querySelector('#editStudentId').value), {
                first_name: document.querySelector('#editFirstNameInput').value.trim(),
                last_name: document.querySelector('#editLastNameInput').value.trim(),
                massar_code: document.querySelector('#editMassarInput').value.trim() || null,
                birth_date: document.querySelector('#editBirthDateInput').value || null,
                student_number: document.querySelector('#editStudentNumberInput').value.trim() || null,
            });
            event.currentTarget.closest('dialog')?.close();
            await loadClass();
            ui.toast(t('student_updated'));
        } catch (error) {
            ui.toast(error.message || 'Erreur de modification.', true);
        }
    });

    document.querySelector('#addClassBtn')?.addEventListener('click', () => document.querySelector('#classDialog')?.showModal());
    document.querySelector('#classForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await API.createClass({
                name: document.querySelector('#classNameInput').value.trim(),
                level: document.querySelector('#classLevelInput').value.trim(),
                branch: document.querySelector('#classBranchInput').value.trim(),
            });
            event.currentTarget.closest('dialog')?.close();
            event.currentTarget.reset();
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            ui.classes();
            ui.toast(t('class_created'));
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
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
            ui.toast(error.message || 'Erreur de chargement archive.', true);
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
            ui.toast(error.message || 'Erreur de modification de classe.', true);
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
            ui.toast(error.message || 'Erreur de modification utilisateur.', true);
        }
    });

    document.querySelector('#resetUserPasswordForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = Number(document.querySelector('#resetUserId').value);
        const password = document.querySelector('#resetUserPasswordInput').value;
        try {
            await API.resetUserPassword(userId, password);
            event.currentTarget.reset();
            document.querySelector('#resetUserPasswordDialog')?.close();
            await loadAdmin();
            ui.toast(t('password_reset'));
        } catch (error) {
            ui.toast(error.message || 'Erreur de réinitialisation.', true);
        }
    });

    document.querySelector('#userForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await API.createUser({
                username: document.querySelector('#userUsernameInput').value.trim(),
                full_name: document.querySelector('#userFullNameInput').value.trim(),
                role: document.querySelector('#userRoleInput').value,
                password: document.querySelector('#userPasswordInput').value,
            });
            event.currentTarget.reset();
            await loadAdmin();
            ui.toast(t('user_created'));
        } catch (error) {
            ui.toast(error.message || 'Erreur de création utilisateur.', true);
        }
    });

    document.querySelector('#academicYearForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await API.createAcademicYear({
                name: document.querySelector('#academicYearNameInput').value.trim(),
                starts_on: document.querySelector('#academicYearStartInput').value,
                ends_on: document.querySelector('#academicYearEndInput').value,
                activate: document.querySelector('#academicYearActivateInput').value === '1',
            });
            event.currentTarget.reset();
            await loadAdmin();
            const classes = await API.classes();
            setOperationalClasses(classes.classes || []);
            renderAll();
            if (state.classId) await loadClass();
            ui.toast(t('year_created'));
        } catch (error) {
            ui.toast(error.message || 'Erreur année scolaire.', true);
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
            ui.toast(error.message || 'Erreur d’affectation.', true);
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
            ui.toast(error.message || 'Erreur de transfert.', true);
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
            ui.toast(error.message || 'Erreur d’import.', true);
        }
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
                ui.toast(active ? 'Classe activée.' : 'Classe désactivée.');
            }
        } catch (error) {
            ui.toast(error.message || 'Erreur de classe.', true);
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
            ui.toast(error.message || 'Erreur de compte utilisateur.', true);
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
            ui.toast(error.message || 'Erreur de retrait.', true);
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
            ui.toast(error.message || 'Impossible d’activer cette année.', true);
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
                if (!window.confirm('Importer tous les élèves valides de ce batch ?')) return;
                await API.runImport(Number(runImport.dataset.runImport));
                await loadClass();
                await loadAdmin();
                ui.toast(t('import_finished'));
            }
        } catch (error) {
            ui.toast(error.message || 'Erreur d’import.', true);
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
            ui.toast(error.message || 'Erreur pendant la correction.', true);
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
        ui.toast(error.message || 'Impossible de charger la signature.', true);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('sams:language', () => renderAll());
    ensureArchiveDynamicUI();
    ensureAdminDynamicUI();
    wire();
    boot();
});
