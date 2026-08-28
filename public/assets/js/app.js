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
    } catch (error) {
        ui.toast(error.message || 'Erreur de démarrage.', true);
    } finally {
        loading = false;
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
        if (status === '') await API.deleteAttendance(payload);
        else await API.setAttendance({ ...payload, status });
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

    document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.tab));
        setState({ tab: button.dataset.tab });
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
                student_number: document.querySelector('#studentNumberInput').value.trim() || null,
            });
            form.closest('dialog')?.close();
            form.reset();
            await loadClass();
            ui.toast('Élève ajouté.');
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
    });

    document.querySelector('#studentsList')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-delete-student]');
        if (!button || !state.classId) return;
        if (!window.confirm('Désactiver cet élève ?')) return;
        try {
            await API.deleteStudent(state.classId, Number(button.dataset.deleteStudent));
            await loadClass();
            ui.toast('Élève désactivé.');
        } catch (error) { ui.toast(error.message || 'Erreur.', true); }
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
