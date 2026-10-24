import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useSession } from '../../features/auth/useSession.ts'
import type { AdminUser } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, dateTime } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, Dialog, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

export function AdminUsersPage() {
  const { t } = useI18n()
  const session = useSession()
  const load = useCallback(() => adminApi.users(), [])
  const resource = useAdminResource(load)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [busy, setBusy] = useState<number | 'form' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [manageTarget, setManageTarget] = useState<AdminUser | null>(null)
  const [query, setQuery] = useState('')
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all')

  const resetAdminForm = () => {
    setFullName('')
    setUsername('')
    setPassword('')
  }

  const createAdministrator = async () => {
    if (!fullName.trim() || !username.trim() || !password) return

    setBusy('form')
    setError(null)
    try {
      await adminApi.createAdministrator({
        username: username.trim(),
        full_name: fullName.trim(),
        password,
      })
      resetAdminForm()
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
        const result = await adminApi.reissueSamsCode(user.id)
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

  const deleteAdministrator = async () => {
    if (deleteTarget === null) return
    setBusy(deleteTarget.id)
    setError(null)
    try {
      await adminApi.deleteAdministrator(deleteTarget.id)
      setDeleteTarget(null)
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

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return (resource.data?.users ?? [])
      .filter((user) => user.role === 'admin')
      .filter((user) => {
        const matchesQuery = normalized === '' || [
          user.full_name,
          user.username,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
        const online = Boolean(Number(user.is_online))
        const matchesPresence = presenceFilter === 'all'
          || (presenceFilter === 'online' ? online : !online)
        return matchesQuery && matchesPresence
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [resource.data?.users, query, presenceFilter])

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
  const adminCount = data.users.filter((user) => user.role === 'admin').length
  const isCurrentAdmin = (user: AdminUser): boolean => {
    const currentId = session.user?.id
    return currentId !== null && currentId !== undefined && Number(currentId) === Number(user.id)
  }

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

        <section className="sams-card space-y-4 p-5">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.administrator)}</p>
            <h2 className="mt-1 text-lg font-semibold">{t(TRANSLATION_KEYS.admin.createAdministrator)}</h2>
            <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.userAdminHint)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={t(TRANSLATION_KEYS.admin.fullName)}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} />}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.username)}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" maxLength={50} />}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.password)}>
              {({ id, ...aria }) => <Input id={id} {...aria} type="password" autoComplete="new-password" minLength={10} maxLength={255} value={password} onChange={(event) => setPassword(event.target.value)} />}
            </FormField>
          </div>
          <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.passwordPolicyHint)}</p>
          <Button
            type="button"
            disabled={!fullName.trim() || !username.trim() || password.length < 10 || busy !== null}
            loading={busy === 'form'}
            onClick={() => void createAdministrator()}
          >
            {t(TRANSLATION_KEYS.admin.create)}
          </Button>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.administrator)}</p>
              <h2 className="mt-1 text-xl font-semibold">{t(TRANSLATION_KEYS.navigation.users)}</h2>
            </div>
            <p className="text-sm text-[var(--sams-muted)]">
              {t(TRANSLATION_KEYS.admin.showingResults)}: {filteredUsers.length} / {adminCount}
            </p>
          </div>

          <AdminWorkspaceToolbar
            searchLabel={t(TRANSLATION_KEYS.admin.search)}
            searchPlaceholder={t(TRANSLATION_KEYS.admin.searchUsers)}
            searchValue={query}
            onSearchChange={setQuery}
          >
            <FormField label={t(TRANSLATION_KEYS.admin.presence)}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as typeof presenceFilter)}>
                  <option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option>
                  <option value="online">{t(TRANSLATION_KEYS.admin.online)}</option>
                  <option value="offline">{t(TRANSLATION_KEYS.admin.offline)}</option>
                </Select>
              )}
            </FormField>
          </AdminWorkspaceToolbar>

          {filteredUsers.length === 0 ? (
            <EmptyState title={t(TRANSLATION_KEYS.admin.administrator)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
          ) : (
            <Table
              caption={t(TRANSLATION_KEYS.admin.administrator)}
              headers={[
                t(TRANSLATION_KEYS.admin.fullName),
                t(TRANSLATION_KEYS.admin.username),
                t(TRANSLATION_KEYS.admin.status),
                t(TRANSLATION_KEYS.admin.presence),
                t(TRANSLATION_KEYS.admin.lastSeen),
                t(TRANSLATION_KEYS.admin.security),
                t(TRANSLATION_KEYS.admin.actions),
              ]}
            >
              {filteredUsers.map((user) => {
                const online = Boolean(Number(user.is_online))
                return (
                  <tr key={user.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                    <td className="px-3 py-3 font-medium">{user.full_name}</td>
                    <td className="px-3 py-3">{user.username}</td>
                    <td className="px-3 py-3">
                      <Badge variant={user.account_status === 'active' ? 'success' : user.account_status === 'suspended' ? 'warning' : 'danger'}>
                        {user.account_status === 'active'
                          ? t(TRANSLATION_KEYS.admin.statusActive)
                          : user.account_status === 'suspended'
                            ? t(TRANSLATION_KEYS.admin.statusSuspended)
                            : t(TRANSLATION_KEYS.admin.statusDeactivated)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={online ? 'success' : 'neutral'}>
                        {online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm">{dateTime(user.last_seen_at)}</td>
                    <td className="px-3 py-3 text-sm">
                      {asNumber(user.failed_login_attempts)} {t(TRANSLATION_KEYS.admin.failedAttempts)}
                      {user.locked_until ? ' · ' + t(TRANSLATION_KEYS.admin.locked) : ''}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => setManageTarget(user)}
                      >
                        {t(TRANSLATION_KEYS.admin.actions)}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </section>
      </section>

      <Dialog
        open={manageTarget !== null}
        title={t(TRANSLATION_KEYS.admin.actions)}
        description={manageTarget ? manageTarget.full_name + ' · ' + manageTarget.username : ''}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { if (busy === null) setManageTarget(null) }}
        className="max-w-3xl"
      >
        {manageTarget !== null && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)]/40 p-4">
                <h3 className="text-sm font-semibold text-[var(--sams-text)]">
                  {t(TRANSLATION_KEYS.admin.userAccountActions)}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(!isCurrentAdmin(manageTarget) || manageTarget.account_status !== 'active') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        const target = manageTarget
                        if (target === null) return
                        setManageTarget(null)
                        void action(target, target.account_status === 'active' ? 'suspended' : 'active')
                      }}
                    >
                      {manageTarget.account_status === 'active'
                        ? t(TRANSLATION_KEYS.admin.suspend)
                        : t(TRANSLATION_KEYS.admin.activate)}
                    </Button>
                  )}
                  {manageTarget.account_status === 'active' && !isCurrentAdmin(manageTarget) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        const target = manageTarget
                        if (target === null) return
                        setManageTarget(null)
                        void action(target, 'deactivated')
                      }}
                    >
                      {t(TRANSLATION_KEYS.admin.deactivate)}
                    </Button>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)]/40 p-4">
                <h3 className="text-sm font-semibold text-[var(--sams-text)]">
                  {t(TRANSLATION_KEYS.admin.securityActions)}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {manageTarget.locked_until && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        const target = manageTarget
                        if (target === null) return
                        setManageTarget(null)
                        void action(target, 'unlock')
                      }}
                    >
                      {t(TRANSLATION_KEYS.admin.unlock)}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      const target = manageTarget
                      if (target === null) return
                      setManageTarget(null)
                      setResetTarget(target)
                      setResetPasswordValue('')
                      setError(null)
                    }}
                  >
                    {t(TRANSLATION_KEYS.admin.resetPassword)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      const target = manageTarget
                      if (target === null) return
                      setManageTarget(null)
                      void action(target, 'revoke')
                    }}
                  >
                    {t(TRANSLATION_KEYS.admin.revokeSessions)}
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)]/40 p-4 sm:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--sams-text)]">
                  {t(TRANSLATION_KEYS.admin.userAccessCode)}
                </h3>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      const target = manageTarget
                      if (target === null) return
                      setManageTarget(null)
                      void action(target, 'code')
                    }}
                  >
                    {t(TRANSLATION_KEYS.admin.reissueCode)}
                  </Button>
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-[var(--sams-danger)]/25 bg-[var(--sams-danger-surface)]/40 p-4">
              <h3 className="text-sm font-semibold text-[var(--sams-danger)]">
                {t(TRANSLATION_KEYS.admin.dangerZone)}
              </h3>
              {isCurrentAdmin(manageTarget) ? (
                <p className="mt-2 text-sm leading-6 text-[var(--sams-muted)]">
                  {t(TRANSLATION_KEYS.admin.selfDeleteBlocked)}
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-sm leading-6 text-[var(--sams-muted)]">
                    {t(TRANSLATION_KEYS.admin.deleteUserWarning)}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busy !== null || session.user?.id == null}
                    onClick={() => {
                      const target = manageTarget
                      if (target === null || session.user?.id == null || isCurrentAdmin(target)) return
                      setManageTarget(null)
                      setDeleteTarget(target)
                      setError(null)
                    }}
                  >
                    {t(TRANSLATION_KEYS.admin.deleteUser)}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        role="alertdialog"
        title={t(TRANSLATION_KEYS.admin.confirmDeleteUser)}
        description={deleteTarget ? deleteTarget.full_name + ' · ' + deleteTarget.username : ''}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { if (busy === null) setDeleteTarget(null) }}
      >
        <div className="space-y-4">
          <p className="rounded-xl border border-[var(--sams-danger)]/20 bg-[var(--sams-danger-surface)] p-4 text-sm leading-6 text-[var(--sams-danger)]">
            {t(TRANSLATION_KEYS.admin.deleteUserWarning)}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setDeleteTarget(null)}>
              {t(TRANSLATION_KEYS.admin.cancel)}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleteTarget === null || busy !== null}
              loading={deleteTarget !== null && busy === deleteTarget.id}
              onClick={() => void deleteAdministrator()}
            >
              {t(TRANSLATION_KEYS.admin.deleteUser)}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={resetTarget !== null}
        title={t(TRANSLATION_KEYS.admin.resetPassword)}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { if (busy === null) { setResetTarget(null); setResetPasswordValue('') } }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--sams-muted)]">{resetTarget?.full_name}</p>
          <FormField label={t(TRANSLATION_KEYS.admin.password)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="password" autoComplete="new-password" minLength={10} maxLength={255} value={resetPasswordValue} onChange={(event) => setResetPasswordValue(event.target.value)} />}
          </FormField>
          <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.passwordPolicyHint)}</p>
          <Button type="button" disabled={resetPasswordValue.length < 10 || busy !== null} loading={resetTarget !== null && busy === resetTarget.id} onClick={() => void submitResetPassword()}>{t(TRANSLATION_KEYS.admin.save)}</Button>
        </div>
      </Dialog>
    </>
  )
}

