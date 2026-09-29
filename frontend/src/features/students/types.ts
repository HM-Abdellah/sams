export interface Student {
  id: number
  student_number: string | null
  massar_code: string | null
  birth_date: string | null
  first_name: string
  last_name: string
  status: 'active' | 'inactive' | string
  created_at: string
  updated_at: string
}

export interface ClassStudentsData {
  students: Student[]
}
