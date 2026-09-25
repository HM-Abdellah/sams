export const state = {
  user: null,
  csrf: '',
  classes: [],
  adminClasses: [],
  students: [],
  attendance: [],
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
  month: new Date().toISOString().slice(0, 7),
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
    month: new Date().toISOString().slice(0, 7),
    weekStart: '',
    selectedDay: '',
    selectedPeriod: 1,
    tab: 'attendance',
    archiveView: 'days',
    filter: 'all',
    search: ''
  });
}
