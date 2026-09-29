import { apiClient } from '../../services/api/client.ts'

export interface SignatureRecord {
  id: number
  teacher_id: number
  class_id: number
  signature_data: string
  created_at: string
  updated_at: string
}

interface SignatureGetData {
  signature: SignatureRecord | null
}

interface SignatureSaveData {
  signature: SignatureRecord
}

interface SignatureDeleteData {
  changed: boolean
}

export const signaturesApi = {
  get(classId: number): Promise<SignatureGetData> {
    return apiClient.request<SignatureGetData>(`/classes/${classId}/signature`)
  },

  save(classId: number, signatureData: string): Promise<SignatureSaveData> {
    return apiClient.request<SignatureSaveData>(`/classes/${classId}/signature`, {
      method: 'POST',
      body: { signature_data: signatureData },
    })
  },

  delete(classId: number): Promise<SignatureDeleteData> {
    return apiClient.request<SignatureDeleteData>(`/classes/${classId}/signature`, {
      method: 'DELETE',
    })
  },
}
