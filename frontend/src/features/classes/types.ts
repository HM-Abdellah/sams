export interface TeacherClass {
  id: number
  name: string
  level: string | null
  branch: string | null
  academic_year_id: number
  academic_year_name?: string | null
  academic_year_starts_on?: string | null
  academic_year_ends_on?: string | null
}

export interface TeacherClassesData {
  classes: TeacherClass[]
}
