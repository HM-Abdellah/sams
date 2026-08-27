import { API, setCsrf, getCsrf } from './api.js';
import { state, setState } from './state.js';
import { ui, renderAll } from './ui.js';
import { setupSignature } from './signature.js';

let busy = false;
let clickTimer = null;

function latestMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

async function loadClass() {
  if (!state.classId) return;
  try {
    const [students, attendance] = await Promise.all([
      API.students(state.classId),
      API.attendance(state.classId, state.weekStart),
    ]);
    setState({students: students.students || [], attendance: attendance.attendance || []});
    renderAll();
    await loadSignature();
  } catch (e) { ui.toast(e.message || 'Erreur de chargement.', true); }
}

async function boot() {
  if (busy) return;
  busy = true;
  try {
    const session = await API.session();
    if (!session.authenticated) { window.location.href = 'login.php'; return; }
    setCsrf(session.csrf || getCsrf());
    setState({user: session.user, csrf: session.csrf || getCsrf(), weekStart: latestMonday()});
    const classes = await API.classes();
    const list = classes.classes || [];
    setState({classes: list, classId: list[0]?.id ?? null});
    document.querySelector('#currentUser').textContent = `${state.user.full_name} · ${state.user.role}`;
    if (state.user.role !== 'admin') document.querySelectorAll('.admin-only').forEach(el => el.remove());
    renderAll();
    if (state.classId) await loadClass();
  } catch (e) { ui.toast(e.message || 'Erreur de démarrage.', true); }
  finally { busy = false; }
}

async function setAttendanceCell(td, forceAbsent = false) {
  if (!state.classId || !td) return;
  const current = td.dataset.status || '';
  const status = forceAbsent ? 'absent' : current === '' ? 'present' : current === 'present' ? '' : '';
  const payload = {student_id:Number(td.dataset.student), attendance_date:td.dataset.date, period:Number(td.dataset.period)};
  try {
    if (!status) {
      // The current API contract uses a valid status; deletion is intentionally not
      // silently simulated. A clear operation is implemented as DELETE in the next API phase.
      ui.toast('Pour effacer une cellule, utilisez la valeur déjà enregistrée comme absent puis corrigez-la depuis la base.', true);
      return;
    }
    await API.setAttendance({...payload, status});
    await loadClass();
    ui.toast(status === 'absent' ? 'Absence enregistrée.' : 'Présence enregistrée.');
  } catch (e) { ui.toast(e.message || 'Échec de sauvegarde.', true); }
}

function wire() {
  document.querySelector('#reloadBtn')?.addEventListener('click', loadClass);
  document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    try { await API.logout(); window.location.href = 'login.php'; }
    catch (e) { ui.toast(e.message, true); }
  });
  document.querySelector('#themeBtn')?.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('sams-theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });
  const savedTheme = localStorage.getItem('sams-theme');
  if (savedTheme === 'light') document.body.classList.add('light');

  document.querySelector('#classSelect')?.addEventListener('change', async e => { setState({classId:Number(e.target.value)}); await loadClass(); });
  document.querySelector('#weekStart')?.addEventListener('change', async e => { setState({weekStart:e.target.value}); await loadClass(); });
  document.querySelector('#studentSearch')?.addEventListener('input', e => { setState({search:e.target.value}); ui.attendance(); });
  document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); setState({filter:btn.dataset.filter}); ui.attendance();
  }));
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.tab));
    setState({tab:btn.dataset.tab});
    if (btn.dataset.tab === 'statistics') ui.statistics();
  }));

  document.querySelector('#attendanceBody')?.addEventListener('click', e => {
    const td = e.target.closest('.attendance-cell'); if (!td) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => setAttendanceCell(td, false), 220);
  });
  document.querySelector('#attendanceBody')?.addEventListener('dblclick', e => {
    const td = e.target.closest('.attendance-cell'); if (!td) return;
    clearTimeout(clickTimer); setAttendanceCell(td, true);
  });

  document.querySelector('#addStudentBtn')?.addEventListener('click', () => document.querySelector('#studentDialog').showModal());
  document.querySelector('#studentForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fn = document.querySelector('#firstNameInput').value.trim();
    const ln = document.querySelector('#lastNameInput').value.trim();
    const number = document.querySelector('#studentNumberInput').value.trim();
    if (!fn || !ln) return ui.toast('Prénom et nom obligatoires.', true);
    try { await API.createStudent(state.classId, {first_name:fn,last_name:ln,student_number:number||null}); e.target.closest('dialog').close(); e.target.reset(); await loadClass(); ui.toast('Élève ajouté.'); }
    catch (err) { ui.toast(err.message, true); }
  });
  document.querySelector('#studentsList')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete-student]'); if (!btn) return;
    if (!confirm('Supprimer cet élève de la classe ?')) return;
    try { await API.deleteStudent(state.classId, Number(btn.dataset.deleteStudent)); await loadClass(); ui.toast('Élève désactivé.'); }
    catch (err) { ui.toast(err.message, true); }
  });
  document.querySelector('#addClassBtn')?.addEventListener('click', () => document.querySelector('#classDialog').showModal());
  document.querySelector('#classForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await API.createClass({name:document.querySelector('#classNameInput').value.trim(),level:document.querySelector('#classLevelInput').value.trim(),branch:document.querySelector('#classBranchInput').value.trim()});
      e.target.closest('dialog').close(); e.target.reset();
      const c = await API.classes(); setState({classes:c.classes || []}); ui.classes(); ui.toast('Classe créée.');
    } catch (err) { ui.toast(err.message, true); }
  });
  document.querySelector('#printBtn')?.addEventListener('click', () => window.print());
  setupSignature({
    canvas: document.querySelector('#signatureCanvas'),
    clearButton: document.querySelector('#clearSignatureBtn'),
    saveButton: document.querySelector('#saveSignatureBtn'),
    load: loadSignature,
  });
}

async function loadSignature() {
  if (!state.classId || !document.querySelector('#signatureCanvas')) return;
  try {
    const data = await API.signature(state.classId);
    window.dispatchEvent(new CustomEvent('sams:signature-load', {detail:data.signature?.signature_data || ''}));
  } catch (e) { ui.toast(e.message || 'Impossible de charger la signature.', true); }
}

window.addEventListener('DOMContentLoaded', () => { wire(); boot(); });
