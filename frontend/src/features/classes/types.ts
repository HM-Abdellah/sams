export interface TeacherClass {
  id: number
  name: string
  level: string | null
  branch: string | null
  academic_year_id: number
}

export interface TeacherClassesData {
  classes: TeacherClass[]
}
