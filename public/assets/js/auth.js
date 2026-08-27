import { API, setCsrf } from './api.js';

export function isAuthenticated(user) { return Boolean(user && Number.isInteger(Number(user.id)) && ['admin','teacher','counselor'].includes(user.role)); }

async function submitLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector('#loginBtn');
  const error = document.querySelector('#loginError');
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  setCsrf(csrf);
  error.hidden = true;
  button.disabled = true;
  try {
    const data = await API.login(form.username.value.trim(), form.password.value, csrf);
    if (data.csrf) setCsrf(data.csrf);
    window.location.href = 'index.php';
  } catch (e) {
    error.textContent = e.message || 'Échec de connexion.';
    error.hidden = false;
  } finally { button.disabled = false; }
}

if (document.querySelector('#loginForm')) {
  document.querySelector('#loginForm').addEventListener('submit', submitLogin);
} else {
  document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    try { await API.logout(); window.location.href = 'login.php'; }
    catch (e) { alert(e.message || 'Impossible de se déconnecter.'); }
  });
}
