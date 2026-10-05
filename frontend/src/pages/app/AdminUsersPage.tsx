import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminUser } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, isActive } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, Dialog, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'

export function AdminUsersPage() {
  const { t } = useI18n()
  const load = useCallback(() => adminApi.users(), [])
  const resource = useAdminResource(load)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<AdminUser['role']>('teacher')
  const [employeeId, setEmployeeId] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [busy, setBusy] = useState<number | 'form' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)

  const resetForm = () => {
    setEditing(null)
    setFullName('')
    setRole('teacher')
    setEmployeeId('')
    setPhone('')
    setUsername('')
    setPassword('')
  }

  const startEdit = (user: AdminUser) => {
    if (!isActive(user.is_active)) return
    setEditing(user)
    setFullName(user.full_name)
    setRole(user.role)
    setEmployeeId(user.employee_id ?? '')
    setPhone(user.phone ?? '')
    setUsername(user.username)
    setPassword('')
    setError(null)
    setIssuedCode(null)
  }

  const save = async () => {
    const hasRequiredUsername = role === 'teacher'
      ? Boolean(employeeId.trim() || username.trim())
      : Boolean(username.trim())
    if (!fullName.trim() || !hasRequiredUsername || (!editing && !password)) {
      return
    }

    setBusy('form')
    setError(null)
    try {
      if (editing) {
        await adminApi.updateUser({
          id: editing.id,
          full_name: fullName,
          role,
          is_active: true,
          employee_id: employeeId || undefined,
          phone: phone || undefined,
        })
      } else {
        await adminApi.createUser({
          username: role === 'teacher' ? employeeId || username : username,
          full_name: fullName,
          role,
          password,
          employee_id: employeeId || undefined,
          phone: phone || undefined,
        })
      }
      resetForm()
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const action = async (
    user: AdminUser,
    kind: 'active' | 'suspended' | 'deactivated' | 'unlock' | 'revoke' | 'code',
  ) => {
    if ((kind === 'suspended' || kind === 'deactivated') && !window.confirm(t(TRANSLATION_KEYS.admin.confirmAccountAction))) return
    setBusy(user.id)
    setError(null)
    try {
      if (kind === 'code') {
        const result = await adminApi.generateSamsCode(user.id)
        setIssuedCode(result.sams_code)
        return
      }
      if (kind === 'unlock') await adminApi.unlockUser(user.id)
      else if (kind === 'revoke') await adminApi.revokeSessions(user.id)
      else await adminApi.setUserStatus(user.id, kind)
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const submitResetPassword = async () => {
    if (resetTarget === null || !resetPasswordValue.trim()) return
    setBusy(resetTarget.id)
    setError(null)
    try {
      await adminApi.resetPassword(resetTarget.id, resetPasswordValue)
      setResetTarget(null)
      setResetPasswordValue('')
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  if (resource.status === 'idle' || resource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }
  if (resource.status === 'error' || resource.data === null) {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />
    )
  }

  const data = resource.data
  return (
    <>
      <section className="sams-admin-page space-y-8">
        <PageHeader
          title={t(TRANSLATION_KEYS.navigation.users)}
          description={t(TRANSLATION_KEYS.admin.userAdminHint)}
        />

        {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}

        {issuedCode && (
          <section role="status" className="rounded-lg border border-[var(--sams-warning)] bg-[var(--sams-warning-surface)] p-4">
            <p className="font-semibold">{t(TRANSLATION_KEYS.admin.newSamsCode)}</p>
            <code className="mt-2 block text-lg">{issuedCode}</code>
            <p className="mt-1 text-sm">{t(TRANSLATION_KEYS.admin.oneTimeSecret)}</p>
          </section>
        )}

        <section className="space-y-4 sams-card p-5">
          <h2 className="text-lg font-semibold">{editing ? t(TRANSLATION_KEYS.admin.editUser) : t(TRANSLATION_KEYS.admin.createUser)}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {!editing && <FormField label={t(TRANSLATION_KEYS.admin.username)}>{({ id, ...aria }) => <Input id={id} {...aria} value={username} onChange={(e) => setUsername(e.target.value)} />}</FormField>}
            <FormField label={t(TRANSLATION_KEYS.admin.fullName)}>{({ id, ...aria }) => <Input id={id} {...aria} value={fullName} onChange={(e) => setFullName(e.target.value)} />}</FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.role)}>{({ id, ...aria }) => <Select id={id} {...aria} value={role} onChange={(e) => setRole(e.target.value as AdminUser['role'])}><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="counselor">Counselor</option></Select>}</FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.employeeId)}>{({ id, ...aria }) => <Input id={id} {...aria} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />}</FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.phone)}>{({ id, ...aria }) => <Input id={id} {...aria} value={phone} onChange={(e) => setPhone(e.target.value)} />}</FormField>
            {!editing && <FormField label={t(TRANSLATION_KEYS.admin.password)}>{({ id, ...aria }) => <Input id={id} {...aria} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</FormField>}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={
                !fullName.trim()
                || !(role === 'teacher' ? employeeId.trim() || username.trim() : username.trim())
                || (!editing && !password)
                || busy === 'form'
              }
              loading={busy === 'form'}
              onClick={() => void save()}
            >
              {t(TRANSLATION_KEYS.admin.save)}
            </Button>
            {editing && <Button type="button" variant="secondary" onClick={resetForm}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>}
          </div>
        </section>
        <Table caption={t(TRANSLATION_KEYS.navigation.users)} headers={[
          t(TRANSLATION_KEYS.admin.fullName),
          t(TRANSLATION_KEYS.admin.username),
          t(TRANSLATION_KEYS.admin.role),
          t(TRANSLATION_KEYS.admin.status),
          t(TRANSLATION_KEYS.admin.security),
          t(TRANSLATION_KEYS.admin.actions),
        ]}>
          {data.users.map((user) => (
            <tr key={user.id} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{user.full_name}</td>
              <td className="px-3 py-2">{user.username}</td>
              <td className="px-3 py-2">{user.role}</td>
              <td className="px-3 py-2">
                <Badge variant={user.account_status === 'active' ? 'success' : user.account_status === 'suspended' ? 'warning' : 'neutral'}>{user.account_status}</Badge>
              </td>
              <td className="px-3 py-2 text-sm">
                {asNumber(user.failed_login_attempts)} {t(TRANSLATION_KEYS.admin.failedAttempts)}
                {user.locked_until ? ' · ' + t(TRANSLATION_KEYS.admin.locked) : ''}
              </td>
              <td className="sticky end-0 z-10 w-[340px] min-w-[340px] max-w-[340px] border-s border-[var(--sams-border)] bg-[var(--sams-surface)] px-3 py-2">
                <div className="w-[316px] max-w-[316px] overflow-x-auto">
                  <div className="flex min-w-max flex-nowrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={!isActive(user.is_active)} onClick={() => startEdit(user)}>{t(TRANSLATION_KEYS.admin.edit)}</Button>
                  {user.locked_until && <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => void action(user, 'unlock')}>{t(TRANSLATION_KEYS.admin.unlock)}</Button>}
                  <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => void action(user, user.account_status === 'active' ? 'suspended' : 'active')}>{user.account_status === 'active' ? t(TRANSLATION_KEYS.admin.suspend) : t(TRANSLATION_KEYS.admin.activate)}</Button>
                  {user.account_status === 'active' && <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => void action(user, 'deactivated')}>{t(TRANSLATION_KEYS.admin.deactivate)}</Button>}
                  <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => { setResetTarget(user); setResetPasswordValue(''); setError(null) }}>{t(TRANSLATION_KEYS.admin.resetPassword)}</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => void action(user, 'revoke')}>{t(TRANSLATION_KEYS.admin.revokeSessions)}</Button>
                  {user.role !== 'admin' && !Boolean(user.has_active_sams_code) && (
                    <Button type="button" size="sm" variant="secondary" disabled={busy === user.id} onClick={() => void action(user, 'code')}>
                      {t(TRANSLATION_KEYS.admin.generateSamsCode)}
                    </Button>
                  )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <Dialog
        open={resetTarget !== null}
        title={t(TRANSLATION_KEYS.admin.resetPassword)}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { setResetTarget(null); setResetPasswordValue('') }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--sams-muted)]">{resetTarget?.full_name}</p>
          <FormField label={t(TRANSLATION_KEYS.admin.password)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="password" autoComplete="new-password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />}
          </FormField>
          <Button type="button" disabled={!resetPasswordValue.trim() || busy !== null} loading={resetTarget !== null && busy === resetTarget.id} onClick={() => void submitResetPassword()}>{t(TRANSLATION_KEYS.admin.save)}</Button>
        </div>
      </Dialog>
    </>
  )
}
