import { API, setCsrf, getCsrf } from './api.js';
import { state, setState } from './state.js';
import { ui, renderAll } from './ui.js';
import { setupSignature } from './signature.js';
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
            API.attendance(state.classId, currentMonth()),
        ]);
        setState({ students: students.students || [], attendance: attendance.attendance || [] });
        renderAll();
        await loadSignature();
    } catch (error) {
        ui.toast(error.message || 'Erreur de chargement.', true);
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
        setState({ user: session.user, csrf: session.csrf || '', month });
        initLanguage();
        await startPresenceHeartbeat();

        const classes = await API.classes();
        const list = Array.isArray(classes.classes) ? classes.classes : [];
        setOperationalClasses(list);

        const monthInput = document.querySelector('#monthSelect');
        if (monthInput) monthInput.value = month;

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
        ui.toast(error.message || 'Erreur de démarrage.', true);
    } finally {
        loading = false;
    }
}

function ensureArchiveDynamicUI() {
    if (!document.querySelector('#archiveDayDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'archiveDayDialog';
        dialog.innerHTML = '<form><h2>Présences du jour</h2><div id="archiveDayContent"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="archiveDayDialog">Fermer</button></div></form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#studentHistoryDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'studentHistoryDialog';
        dialog.innerHTML = '<form><h2>Historique de l’élève</h2><div id="studentHistoryContent"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="studentHistoryDialog">Fermer</button></div></form>';
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
            + '<h2>Modifier une classe</h2>'
            + '<input id="editClassId" type="hidden">'
            + '<label>Nom<input id="editClassNameInput" required maxlength="100"></label>'
            + '<label>Niveau<input id="editClassLevelInput" maxlength="50"></label>'
            + '<label>Branche<input id="editClassBranchInput" maxlength="100"></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editClassDialog">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#editUserDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'editUserDialog';
        dialog.innerHTML = '<form id="editUserForm">'
            + '<h2>Modifier un utilisateur</h2>'
            + '<input id="editUserId" type="hidden">'
            + '<label>Nom complet<input id="editUserFullNameInput" required maxlength="120"></label>'
            + '<label>Rôle<select id="editUserRoleInput"><option value="teacher">teacher</option><option value="counselor">counselor</option><option value="admin">admin</option></select></label>'
            + '<label>Actif<select id="editUserActiveInput"><option value="1">Oui</option><option value="0">Non</option></select></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="editUserDialog">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#transferStudentDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'transferStudentDialog';
        dialog.innerHTML = '<form id="transferStudentForm">'
            + '<h2>Transférer un élève</h2>'
            + '<input id="transferStudentId" type="hidden">'
            + '<label>Classe cible<select id="transferTargetClassInput" required></select></label>'
            + '<label>Date d’effet<input id="transferEffectiveDateInput" type="date" required></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="transferStudentDialog">Annuler</button><button class="btn primary" type="submit">Transférer</button></div>'
            + '</form>';
        document.body.appendChild(dialog);
    }

    if (!document.querySelector('#resetUserPasswordDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'resetUserPasswordDialog';
        dialog.innerHTML = '<form id="resetUserPasswordForm">'
            + '<h2>Réinitialiser le mot de passe</h2>'
            + '<input id="resetUserId" type="hidden">'
            + '<label>Nouveau mot de passe<input id="resetUserPasswordInput" type="password" minlength="10" maxlength="255" required></label>'
            + '<div class="dialog-actions"><button class="btn" type="button" data-close-dialog="resetUserPasswordDialog">Annuler</button><button class="btn primary" type="submit">Réinitialiser</button></div>'
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
        dialog.innerHTML = '<form id="importCorrectionForm"><h2>Corriger les lignes invalides</h2><div id="importCorrectionRows"></div><div class="dialog-actions"><button class="btn" type="button" data-close-dialog="importCorrectionDialog">Annuler</button><button class="btn primary" type="submit">Corriger et revalider</button></div></form>';
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
            ui.toast('Aucune ligne à corriger.');
            return;
        }

        container.innerHTML = '';
        for (const row of rows) {
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'import-correction-row';
            fieldset.dataset.rowId = String(row.id);
            fieldset.innerHTML = '<legend>Ligne ' + String(row.row_number) + '</legend>'
                + '<small>' + uiEscapeIssues(row.issues) + '</small>'
                + '<label>Prénom<input name="first_name" required maxlength="80" value="' + uiEscapeValue(row.first_name) + '"></label>'
                + '<label>Nom<input name="last_name" required maxlength="80" value="' + uiEscapeValue(row.last_name) + '"></label>'
                + '<label>Massar<input name="massar_code" required maxlength="32" value="' + uiEscapeValue(row.massar_code) + '"></label>'
                + '<label>Date de naissance<input name="birth_date" type="date" required value="' + uiEscapeValue(row.birth_date) + '"></label>'
                + '<label>N° élève<input name="student_number" maxlength="30" value="' + uiEscapeValue(row.student_number) + '"></label>';
            container.appendChild(fieldset);
        }

        dialog.dataset.batchId = String(batchId);
        dialog.showModal();
    } catch (error) {
        ui.toast(error.message || 'Impossible de charger les lignes à corriger.', true);
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

function nextStatus(current) {
    const order = ['', 'present', 'absent', 'late', 'excused'];
    const index = Math.max(0, order.indexOf(current));
    return order[(index + 1) % order.length];
}

async function openAnnualReport() {
    if (!state.classId) return ui.toast('Sélectionnez une classe.', true);
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
            ui.toast(error.message || 'Erreur de déconnexion.', true);
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

    const attendanceBody = document.querySelector('#attendanceBody');
    attendanceBody?.addEventListener('click', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => queueAttendanceChange(td, nextStatus(td.dataset.status || '')), 220);
    });
    attendanceBody?.addEventListener('dblclick', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        clearTimeout(clickTimer);
        queueAttendanceChange(td, 'absent');
    });
    attendanceBody?.addEventListener('contextmenu', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        event.preventDefault();
        clearTimeout(clickTimer);
        queueAttendanceChange(td, '');
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
            ui.toast('Élève ajouté.');
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
                ui.toast('Aucune classe cible disponible.', true);
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
        if (!window.confirm('Désactiver cet élève ?')) return;
        try {
            await API.deleteStudent(state.classId, Number(deleteButton.dataset.deleteStudent));
            await loadClass();
            ui.toast('Élève désactivé.');
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
            ui.toast('Élève modifié.');
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
            ui.toast('Classe créée.');
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
    });

    document.querySelector('#reportBtn')?.addEventListener('click', () => document.querySelector('#reportDialog')?.showModal());
    document.querySelector('#officialReportBtn')?.addEventListener('click', () => { document.querySelector('#reportDialog')?.close(); window.print(); });
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
            ui.toast('Classe modifiée.');
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
            ui.toast('Utilisateur modifié.');
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
            ui.toast('Mot de passe réinitialisé.');
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
            ui.toast('Utilisateur créé.');
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
            ui.toast('Année scolaire créée.');
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
            ui.toast('Affectation enregistrée.');
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
            ui.toast('Transfert effectué.');
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
        if (!state.classId) return ui.toast('Sélectionnez une classe.', true);
        const file = document.querySelector('#studentImportFile')?.files?.[0];
        if (!file) return ui.toast('Sélectionnez un fichier CSV.', true);
        try {
            const result = await API.stageImport(state.classId, file);
            await loadAdmin();
            ui.toast(`Import staging #${result.batch_id} créé.`);
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
                if (!window.confirm(active ? 'Activer cette classe ?' : 'Désactiver cette classe ?')) return;
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
                ui.toast('Compte déverrouillé.');
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
            ui.toast('Affectation retirée.');
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
            ui.toast('Année scolaire activée.');
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
                ui.toast('Import revalidé.');
                return;
            }
            if (runImport && !runImport.disabled) {
                if (!window.confirm('Importer tous les élèves valides de ce batch ?')) return;
                await API.runImport(Number(runImport.dataset.runImport));
                await loadClass();
                await loadAdmin();
                ui.toast('Import terminé.');
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
            ui.toast('Corrections enregistrées et import revalidé.');
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
