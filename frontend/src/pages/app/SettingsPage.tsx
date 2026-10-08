import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { profileApi } from '../../features/profile/api.ts'
import { profileAvatarUrl } from '../../features/profile/avatar.ts'
import { useSession } from '../../features/auth/useSession.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { ApiError } from '../../services/api/errors.ts'
import {
  Button,
  FormField,
  Input,
  Loading,
  PageHeader,
  StatusMessage,
} from '../../components/ui/index.ts'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export function SettingsPage() {
  const { t } = useI18n()
  const session = useSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let mounted = true
    void profileApi.get()
      .then((data) => {
        if (!mounted) return
        setUsername(data.username)
        setFullName(data.full_name)
        setRole(data.role)
        setAvatarUrl(data.avatar_url)
      })
      .catch((cause) => {
        if (mounted) setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [t])

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  const currentAvatar = removeAvatar
    ? null
    : (previewUrl ?? profileAvatarUrl(avatarUrl))
  const roleLabel = role === 'admin'
    ? t(TRANSLATION_KEYS.admin.administrator)
    : role === 'counselor'
      ? t(TRANSLATION_KEYS.admin.counselor)
      : t(TRANSLATION_KEYS.navigation.teachers)

  const save = async () => {
    setSaved(false)
    setError(null)
    setSaving(true)
    try {
      const data = await profileApi.update({
        username: username.trim(),
        full_name: fullName.trim(),
        ...(avatarFile ? { avatar: avatarFile } : {}),
        ...(removeAvatar ? { remove_avatar: true } : {}),
      })
      setUsername(data.username)
      setFullName(data.full_name)
      setAvatarUrl(data.avatar_url)
      setAvatarFile(null)
      setRemoveAvatar(false)
      setSaved(true)
      await session.refresh()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />

  return (
    <section className="sams-admin-page space-y-7">
      <PageHeader
        eyebrow={t(TRANSLATION_KEYS.settings.title)}
        title={t(TRANSLATION_KEYS.settings.profile)}
        description={t(TRANSLATION_KEYS.settings.profileHint)}
        actions={<Button type="button" variant="secondary" onClick={() => navigate(-1)}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>}
      />

      {error && <StatusMessage variant="danger">{error}</StatusMessage>}
      {saved && <StatusMessage variant="success">{t(TRANSLATION_KEYS.settings.saved)}</StatusMessage>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <section className="relative overflow-hidden rounded-[1.25rem] border border-[var(--sams-brand-border)] bg-[linear-gradient(145deg,#123b73_0%,#0d668f_58%,#087f84_100%)] p-6 text-white shadow-[0_18px_45px_rgba(18,59,115,0.12)]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b8fbff]">{t(TRANSLATION_KEYS.settings.profile)}</p>
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 shadow-[0_12px_30px_rgba(4,24,48,0.18)]">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold">{initials(fullName)}</span>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">{fullName || '—'}</h2>
              <p className="mt-1 text-sm text-white/65">{username || '—'}</p>
              <span className="mt-4 rounded-full border border-[#6fe6ee]/25 bg-[#6fe6ee]/10 px-3 py-1.5 text-xs font-semibold text-[#d2fdff]">
                {roleLabel || '—'}
              </span>
            </div>
          </div>
        </section>

        <section className="sams-card space-y-6 p-6">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.settings.profile)}</p>
            <h2 className="mt-1 text-xl font-semibold">{t(TRANSLATION_KEYS.settings.title)}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t(TRANSLATION_KEYS.admin.fullName)}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
              )}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.username)}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              )}
            </FormField>
          </div>

          <div className="rounded-xl border border-[var(--sams-brand-border)] bg-[var(--sams-brand-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{t(TRANSLATION_KEYS.settings.avatar)}</p>
                <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.settings.avatarHint)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--sams-radius-control)] bg-[var(--sams-action)] px-4 text-sm font-medium text-white shadow-sm hover:bg-[var(--sams-action-hover)]">
                  {t(TRANSLATION_KEYS.settings.changeAvatar)}
                  <input
                    className="sr-only"
                    type="file"
                    aria-label={t(TRANSLATION_KEYS.settings.avatar)}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const next = event.target.files?.[0] ?? null
                      setAvatarFile(next)
                      setRemoveAvatar(false)
                    }}
                  />
                </label>
                {currentAvatar && (
                  <Button type="button" variant="secondary" onClick={() => { setAvatarFile(null); setRemoveAvatar(true) }}>
                    {t(TRANSLATION_KEYS.settings.removeAvatar)}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)] p-4 sm:grid-cols-2">
            <div>
              <p className="sams-section-label">{t(TRANSLATION_KEYS.settings.accountRole)}</p>
              <p className="mt-1 font-semibold">{roleLabel || '—'}</p>
            </div>
            <div>
              <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.security)}</p>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.settings.securityHint)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!username.trim() || !fullName.trim() || saving}
              loading={saving}
              onClick={() => void save()}
            >
              {t(TRANSLATION_KEYS.settings.save)}
            </Button>
          </div>
        </section>
      </div>
    </section>
  )
}

