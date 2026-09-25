import { t } from './i18n.js';

const BASE = '../api/';
let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

export function setCsrf(token) { csrfToken = typeof token === 'string' ? token : ''; }
export function getCsrf() { return csrfToken; }

function translateApiError(message, status) {
    const value = String(message || '').trim();
    const exact = new Map([
        ['Authentication required.', 'api_auth_required'],
        ['Forbidden.', 'api_forbidden'],
        ['Method not allowed.', 'api_method_not_allowed'],
        ['Server error.', 'api_server_error'],
        ['Invalid CSRF token.', 'api_csrf'],
        ['Invalid class.', 'api_invalid_class'],
        ['Invalid month.', 'api_invalid_month'],
        ['Invalid credentials.', 'api_credentials'],
        ['Username or employee ID already exists.', 'api_conflict'],
        ['This teaching assignment already exists.', 'api_duplicate_assignment'],
        ['Subject not found or inactive.', 'api_subject_inactive'],
        ['Invalid employee ID.', 'api_employee_invalid'],
        ['Invalid phone number.', 'api_phone_invalid'],
    ]);

    const key = exact.get(value);
    if (key) return t(key);

    if (status === 401) return t('api_auth_required');
    if (status === 403) return t('api_forbidden');
    if (status === 404) return t('api_not_found');
    if (status === 405) return t('api_method_not_allowed');
    if (status === 409) return t('api_conflict');
    if (status === 419) return t('api_csrf');
    if (status === 422) return value || t('api_validation');
    if (status >= 500) return t('api_server_error');

    return value || `HTTP ${status}`;
}

export async function request(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (csrfToken && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);

    let response;
    try {
        response = await fetch(BASE + endpoint, { ...options, credentials: 'same-origin', headers });
    } catch {
        throw new Error(t('api_server_error'));
    }

    const contentType = response.headers.get('content-type') || '';
    let payload;
    try {
        payload = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch {
        throw new Error(t('api_invalid_response'));
    }

    if (!response.ok || payload?.success === false) {
        throw new Error(translateApiError(payload?.error, response.status));
    }

    return payload?.data ?? payload;
}

export const API = Object.freeze({
    session: () => request('auth.php?action=session'),
    login: (username, password, csrf) => request('auth.php?action=login', { method:'POST', headers:{'X-CSRF-Token':csrf}, body:JSON.stringify({username,password,csrf}) }),
    logout: () => request('auth.php?action=logout', { method:'POST' }),

    classes: () => request('classes.php'),
    adminClasses: () => request('classes.php?scope=all'),
    createClass: (data) => request('classes.php', { method:'POST', body:JSON.stringify(data) }),
    updateClass: (id, data) => request('classes.php', { method:'POST', body:JSON.stringify({action:'update', id, ...data}) }),
    setClassActive: (id, active) => request('classes.php', { method:'POST', body:JSON.stringify({action:active ? 'activate' : 'deactivate', id}) }),

    students: (classId) => request(`students.php?class_id=${encodeURIComponent(classId)}`),
    createStudent: (classId, data) => request(`students.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({action:'create',...data}) }),
    updateStudent: (classId, id, data) => request(`students.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({action:'update',id,...data}) }),
    deleteStudent: (classId, id) => request(`students.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({action:'delete',id}) }),
    transferStudent: (classId, id, targetClassId, effectiveDate) => request(`students.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({action:'transfer',id,target_class_id:targetClassId,effective_date:effectiveDate}) }),

    attendance: (classId, month) => request(`attendance.php?class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`),
    attendanceWeek: (classId, weekStart) => request(`attendance.php?class_id=${encodeURIComponent(classId)}&week_start=${encodeURIComponent(weekStart)}`),
    setAttendance: (classId, data) => request(`attendance.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify(data) }),
    bulkAttendance: (classId, entries) => request(`attendance.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({action:'bulk', entries}) }),
    deleteAttendance: (classId, data) => request(`attendance.php?class_id=${encodeURIComponent(classId)}`, { method:'DELETE', body:JSON.stringify(data) }),
    attendanceSignoffs: (classId, weekStart) => request(`attendance-signoffs.php?class_id=${encodeURIComponent(classId)}&week_start=${encodeURIComponent(weekStart)}`),
    attendanceSignoffAction: (classId, data) => request(`attendance-signoffs.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify(data) }),

    signature: (classId) => request(`signatures.php?class_id=${encodeURIComponent(classId)}`),
    saveSignature: (classId, signatureData) => request(`signatures.php?class_id=${encodeURIComponent(classId)}`, { method:'POST', body:JSON.stringify({signature_data:signatureData}) }),
    deleteSignature: (classId) => request(`signatures.php?class_id=${encodeURIComponent(classId)}`, { method:'DELETE', body:JSON.stringify({}) }),

    report: (classId, month) => request(`reports.php?class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`),

    users: () => request('users.php'),
    teachers: () => request('teachers.php'),
    adminDashboard: () => request('admin-dashboard.php'),
    assignTeaching: (teacherId, subjectId, classId) => request('teachers.php', { method:'POST', body:JSON.stringify({action:'assign',teacher_id:teacherId,subject_id:subjectId,class_id:classId}) }),
    unassignTeaching: (id) => request('teachers.php', { method:'POST', body:JSON.stringify({action:'unassign',id}) }),
    createSubject: (data) => request('teachers.php', { method:'POST', body:JSON.stringify({action:'create_subject',...data}) }),
    updateSubject: (id, data) => request('teachers.php', { method:'POST', body:JSON.stringify({action:'update_subject',id,...data}) }),
    createUser: (data) => request('users.php', { method:'POST', body:JSON.stringify({action:'create',...data}) }),
    updateUser: (id, data) => request('users.php', { method:'POST', body:JSON.stringify({action:'update',id,...data}) }),
    resetUserPassword: (id, password) => request('users.php', { method:'POST', body:JSON.stringify({action:'reset_password',id,password}) }),
    unlockUser: (id) => request('users.php', { method:'POST', body:JSON.stringify({action:'unlock',id}) }),

    teacherClasses: ({ classId, teacherId } = {}) => {
        const params = new URLSearchParams();
        if (classId) params.set('class_id', classId);
        if (teacherId) params.set('teacher_id', teacherId);
        return request(`teacher-classes.php?${params.toString()}`);
    },
    assignTeacher: (teacherId, classId) => request('teacher-classes.php', { method:'POST', body:JSON.stringify({teacher_id:teacherId,class_id:classId}) }),
    unassignTeacher: (teacherId, classId) => request('teacher-classes.php', { method:'DELETE', body:JSON.stringify({teacher_id:teacherId,class_id:classId}) }),

    academicYears: () => request('academic-years.php'),
    createAcademicYear: (data) => request('academic-years.php', { method:'POST', body:JSON.stringify({action:'create',...data}) }),
    activateAcademicYear: (id) => request('academic-years.php', { method:'POST', body:JSON.stringify({action:'activate',id}) }),

    imports: (classId) => request(`imports.php?class_id=${encodeURIComponent(classId)}`),
    importBatch: (batchId) => request(`imports.php?batch_id=${encodeURIComponent(batchId)}`),
    stageImport: (classId, file) => {
        const form = new FormData();
        form.append('action', 'stage');
        form.append('class_id', String(classId));
        form.append('file', file);
        return request('imports.php', { method:'POST', body:form });
    },
    correctImportRow: (batchId, rowId, data) => request('imports.php', { method:'POST', body:JSON.stringify({action:'correct',batch_id:batchId,row_id:rowId,...data}) }),
    revalidateImport: (batchId) => request('imports.php', { method:'POST', body:JSON.stringify({action:'revalidate',batch_id:batchId}) }),
    runImport: (batchId) => request('imports.php', { method:'POST', body:JSON.stringify({action:'import',batch_id:batchId}) }),

    archiveDays: (classId, month) => request(`archive.php?view=days&class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`),
    archiveMonth: (classId, month) => request(`archive.php?view=month&class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`),
    archiveDay: (classId, date) => request(`archive.php?view=day&class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`),
    studentHistory: (classId, studentId) => request(`archive.php?view=student&class_id=${encodeURIComponent(classId)}&student_id=${encodeURIComponent(studentId)}`),

    presence: () => request('presence.php', { method:'POST' }),

    audit: (params = {}) => {
        const query = new URLSearchParams(params);
        return request(`audit.php?${query.toString()}`);
    },
});
