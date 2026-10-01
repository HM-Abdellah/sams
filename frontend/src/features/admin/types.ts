export interface AdminClass {
  id: number
  name: string
  level: string | null
  branch: string | null
  academic_year_id: number
  is_active: boolean | number
  academic_year_name: string
  academic_year_active: boolean | number
}

export interface AdminTeacher {
  id: number
  username: string
  employee_id: string | null
  full_name: string
  phone: string | null
  phone_verified: boolean | number
  is_active: boolean | number
  failed_login_attempts: number | string
  locked_until: string | null
  last_login_at: string | null
  last_seen_at: string | null
  is_online: boolean | number
}

export interface AdminSubject {
  id: number
  code: string
  name_fr: string
  name_ar: string
  name_en: string
  is_active: boolean | number
}export interface AdminTeaching {
  id: number
  teacher_id: number
  subject_id: number
  subject_code: string
  subject_name_fr: string
  subject_name_ar: string
  subject_name_en: string
  class_id: number
  class_name: string
  class_level: string | null
  class_branch: string | null
  academic_year_id: number
  academic_year_name: string
  assigned_at: string
}

export interface AdminUser {
  id: number
  school_id: number | null
  username: string
  employee_id: string | null
  full_name: string
  phone: string | null
  phone_verified: boolean | number
  role: 'admin' | 'teacher' | 'counselor'
  account_status: 'active' | 'suspended' | 'deactivated'
  is_active: boolean | number
  failed_login_attempts: number | string
  locked_until: string | null
  last_login_at: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface AcademicYear {
  id: number
  school_id: number
  name: string
  starts_on: string
  ends_on: string
  is_active: boolean | number
  created_at: string
}

export interface OnboardingRequest {
  id: number
  school_id: number
  full_name: string
  employee_id: string | null
  phone: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expires_at: string
  reviewed_by: number | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_user_id: number | null
  created_at: string
  updated_at: string
}

export interface DashboardAcademicYear {
  id: number
  name: string
  starts_on: string
  ends_on: string
}

export interface DashboardTrendPoint {
  date: string
  record_count: number | string
  present_count: number | string
  absent_count: number | string
  late_count: number | string
  excused_count: number | string
  presence_rate: number | null
}

export interface DashboardOnlineTeacher {
  id: number
  full_name: string
  employee_id: string | null
  last_seen_at: string | null
}

export interface DashboardSummary {
  active_classes: number | string
  active_students: number | string
  active_teachers: number | string
  online_teachers: number | string
  unverified_teachers: number | string
  locked_teachers: number | string
  today_records: number | string
  today_present: number | string
  today_absent: number | string
  today_late: number | string
  today_excused: number | string
  today_presence_rate: number
}

export interface DashboardClassStat {
  id: number
  name: string
  level: string | null
  branch: string | null
  academic_year_id: number
  academic_year_name: string
  student_count: number | string
  today_records: number | string
  present_count: number | string
  absent_count: number | string
  late_count: number | string
  excused_count: number | string
}

export interface DashboardAttentionStudent {
  id: number
  first_name: string
  last_name: string
  class_id: number
  class_name: string
  class_level: string | null
  class_branch: string | null
  absent_count: number | string
  late_count: number | string
}

export interface DashboardMissingClass {
  id: number
  name: string
  level: string | null
  branch: string | null
  academic_year_name: string
}

export interface DashboardAudit {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  created_at: string
  full_name: string | null
  username: string | null
}

export interface AdminDashboard {
  date: string
  academic_year: DashboardAcademicYear | null
  absence_alert_threshold: number
  summary: DashboardSummary
  attendance_trend: DashboardTrendPoint[]
  online_teachers: DashboardOnlineTeacher[]
  class_stats: DashboardClassStat[]
  attention_students: DashboardAttentionStudent[]
  classes_without_today_records: DashboardMissingClass[]
  recent_audit: DashboardAudit[]
}

export interface ImportBatch {
  id: number
  created_by: number
  created_by_name: string
  target_academic_year_id: number | null
  target_academic_year_name: string | null
  source_academic_year: string | null
  original_filename: string
  file_sha256: string
  file_size: number | string
  status: string
  total_classes: number | string
  valid_classes: number | string
  warning_classes: number | string
  error_classes: number | string
  total_rows: number | string
  valid_rows: number | string
  warning_rows: number | string
  error_rows: number | string
  imported_at: string | null
  created_at: string
  updated_at: string
}

export interface ImportClass {
  id: number
  batch_id: number
  source_sheet: string
  source_block_start_row: number | string
  source_block_end_row: number | string
  source_class_name: string
  source_level: string | null
  source_academic_year: string | null
  target_class_id: number | null
  status: string
  student_count: number | string
  issues: unknown[] | null
}

export interface ImportRow {
  id: number
  import_class_id: number
  source_row: number | string
  roster_number: number | string | null
  first_name: string
  last_name: string
  massar_code: string | null
  birth_date: string | null
  sex: string | null
  birth_place: string | null
  status: string
  match_status: string | null
  issues: unknown[] | null
  matched_student_id: number | null
  target_enrollment_id: number | null
  created_at?: string
  updated_at?: string
}

export interface ImportWorkflowResult {
  batch_id: number
  ready_to_import?: boolean
  already_imported: boolean
  summary: Record<string, number | boolean | string>
}

export interface ImportPreview {
  batch: ImportBatch
  classes: ImportClass[]
  class?: ImportClass
  rows?: {
    items: ImportRow[]
    total: number
    page: number
    per_page: number
    total_pages: number
  }
}

export interface AuditItem {
  id: number
  user_id: number | null
  username: string | null
  full_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AuditSearch {
  items: AuditItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface IdResult { id: number }
export interface ChangedResult { changed: boolean }
export interface SamsCodeResult { user_id: number; sams_code: string }
export interface OnboardingCodeResult {
  school_id: number
  onboarding_code: string
  expires_at: string
}
export interface SessionVersionResult {
  id: number
  session_version: number
}
