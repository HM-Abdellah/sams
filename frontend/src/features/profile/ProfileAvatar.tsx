import { useState } from 'react'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

interface ProfileAvatarProps {
  name: string
  src: string | null
  imageClassName?: string
  fallbackClassName?: string
  alt?: string
}

export function ProfileAvatar({
  name,
  src,
  imageClassName = 'size-full object-cover',
  fallbackClassName = '',
  alt = '',
}: ProfileAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)

  if (src && failedSource !== src) {
    return (
      <img
        src={src}
        alt={alt}
        className={imageClassName}
        onError={() => setFailedSource(src)}
      />
    )
  }

  return <span className={fallbackClassName} aria-hidden="true">{initials(name)}</span>
}
