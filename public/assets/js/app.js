import { API, setCsrf, getCsrf } from './api.js';
import { state, setState } from './state.js';
import { ui, renderAll } from './ui.js';
import { setupSignature } from './signature.js';

let loading = false;
let clickTimer = null;

function currentMonth() {
    return state.month || new Date().toISOString().slice(0, 7);
}

async function loadClass() {
    if (!state.classId) return;
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

        const classes = await API.classes();
        const list = Array.isArray(classes.classes) ? classes.classes : [];
        setState({ classes: list, classId: list[0]?.id ?? null });

        const monthInput = document.querySelector('#monthSelect');
        if (monthInput) monthInput.value = month;

        const currentUser = document.querySelector('#currentUser');
        if (currentUser && state.user) currentUser.textContent = `${state.user.full_name} · ${state.user.role}`;

        if (state.user?.role !== 'admin') document.querySelectorAll('.admin-only').forEach((el) => el.remove());
        renderAll();
        if (state.classId) await loadClass();
        if (state.user?.role === 'admin') await loadAdmin();
    } catch (error) {
        ui.toast(error.message || 'Erreur de démarrage.', true);
    } finally {
        loading = false;
    }
}

function ensureAdminDynamicUI() {
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

async function loadAdmin() {
    if (state.user?.role !== 'admin') return;
    try {
        ensureAdminDynamicUI();
        const requests = [
            API.users(),
            API.academicYears(),
            state.classId ? API.imports(state.classId) : Promise.resolve({ imports: [] }),
            state.classId ? API.teacherClasses({ classId: state.classId }) : Promise.resolve({ teachers: [] }),
            API.audit({ page: 1, per_page: 20 }),
        ];
        const [users, academicYears, imports, assignments, audit] = await Promise.all(requests);
        setState({
            users: users.users || [],
            academicYears: academicYears.academic_years || [],
            imports: imports.imports || [],
            assignments: assignments.teachers || [],
            auditItems: audit.items || [],
        });
        renderAll();
    } catch (error) {
        ui.toast(error.message || 'Erreur de chargement administration.', true);
    }
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

async function saveCell(td, status) {
    if (!state.classId || !td) return;
    const payload = {
        student_id: Number(td.dataset.student),
        attendance_date: td.dataset.date,
        period: Number(td.dataset.period),
    };
    try {
        if (status === '') await API.deleteAttendance(state.classId, payload);
        else await API.setAttendance(state.classId, { ...payload, status });
        await loadClass();
    } catch (error) {
        ui.toast(error.message || 'Échec de sauvegarde.', true);
    }
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
        document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.tab));
        setState({ tab: button.dataset.tab });

        if (button.dataset.tab === 'archive') await loadArchive('days');
        if (button.dataset.tab === 'admin') await loadAdmin();
    }));

    const attendanceBody = document.querySelector('#attendanceBody');
    attendanceBody?.addEventListener('click', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => saveCell(td, nextStatus(td.dataset.status || '')), 220);
    });
    attendanceBody?.addEventListener('dblclick', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        clearTimeout(clickTimer);
        saveCell(td, 'absent');
    });
    attendanceBody?.addEventListener('contextmenu', (event) => {
        const td = event.target.closest('.attendance-cell');
        if (!td) return;
        event.preventDefault();
        clearTimeout(clickTimer);
        saveCell(td, '');
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
        const editButton = event.target.closest('[data-edit-student]');
        const deleteButton = event.target.closest('[data-delete-student]');
        if (!state.classId) return;

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
            setState({ classes: classes.classes || [] });
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
    const archiveMonth = document.querySelector('#archiveMonth');
    if (archiveMonth) archiveMonth.value = state.month;

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
            setState({ classes: classes.classes || [] });
            renderAll();
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

    document.querySelector('#usersTable')?.addEventListener('click', async (event) => {
        const unlock = event.target.closest('[data-unlock-user]');
        const toggle = event.target.closest('[data-toggle-user]');
        try {
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

    document.querySelector('#importsTable')?.addEventListener('click', async (event) => {
        const revalidate = event.target.closest('[data-revalidate-import]');
        const runImport = event.target.closest('[data-run-import]');
        try {
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
    wire();
    boot();
});
