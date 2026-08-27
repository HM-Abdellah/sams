const BASE = '../api/';

let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

export function setCsrf(token) {
    csrfToken = typeof token === 'string' ? token : '';
}

export function getCsrf() {
    return csrfToken;
}

export async function request(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);

    const response = await fetch(BASE + endpoint, {
        ...options,
        credentials: 'same-origin',
        headers,
    });

    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload?.data ?? payload;
}

export const API = Object.freeze({
    session: () => request('auth.php?action=session'),
    login: (username, password, csrf) => request('auth.php?action=login', {
        method: 'POST', headers: {'X-CSRF-Token': csrf}, body: JSON.stringify({username, password, csrf})
    }),
    logout: () => request('auth.php?action=logout'),
    classes: () => request('classes.php'),
    createClass: data => request('classes.php', {method: 'POST', body: JSON.stringify(data)}),
    students: classId => request(`students.php?class_id=${encodeURIComponent(classId)}`),
    createStudent: (classId, data) => request(`students.php?class_id=${encodeURIComponent(classId)}`, {method: 'POST', body: JSON.stringify({action: 'create', ...data})}),
    deleteStudent: (classId, id) => request(`students.php?class_id=${encodeURIComponent(classId)}`, {method: 'POST', body: JSON.stringify({action: 'delete', id})}),
    attendance: (classId, weekStart) => request(`attendance.php?class_id=${encodeURIComponent(classId)}&week_start=${encodeURIComponent(weekStart)}`),
    setAttendance: data => request('attendance.php', {method: 'POST', body: JSON.stringify(data)}),
    signature: classId => request(`signatures.php?class_id=${encodeURIComponent(classId)}`),
    saveSignature: (classId, signatureData) => request(`signatures.php?class_id=${encodeURIComponent(classId)}`, {method: 'POST', body: JSON.stringify({signature_data: signatureData})}),
});
