function localDateString() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function localMonthString() {
  return localDateString().slice(0, 7);
}

export const state = {
  user: null,
  csrf: '',
  classes: [],
  adminClasses: [],
  students: [],
  attendance: [],
  attendanceSignoffs: { week_start: '', week_end: '', teachers: [], period_signoffs: [], weekly_signatures: [] },
  users: [],
  teachers: [],
  subjects: [],
  teachings: [],
  adminDashboard: null,
  academicYears: [],
  imports: [],
  assignments: [],
  auditItems: [],
  archive: null,
  classId: null,
  month: localMonthString(),
  weekStart: '',
  selectedDay: '',
  selectedPeriod: 1,
  tab: 'attendance',
  archiveView: 'days',
  filter: 'all',
  search: ''
};

export function setState(patch) {
  Object.assign(state, patch);
  window.dispatchEvent(new CustomEvent('sams:state', { detail: { ...state } }));
}

export function resetState() {
  setState({
    user: null,
    csrf: '',
    classes: [],
    adminClasses: [],
    students: [],
    attendance: [],
    attendanceSignoffs: { week_start: '', week_end: '', teachers: [], period_signoffs: [], weekly_signatures: [] },
    users: [],
    teachers: [],
    subjects: [],
    teachings: [],
    adminDashboard: null,
    academicYears: [],
    imports: [],
    assignments: [],
    auditItems: [],
    archive: null,
    classId: null,
    month: localMonthString(),
    weekStart: '',
    selectedDay: '',
    selectedPeriod: 1,
    tab: 'attendance',
    archiveView: 'days',
    filter: 'all',
    search: ''
  });
}
