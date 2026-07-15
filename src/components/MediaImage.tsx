import { useEffect, useState } from 'react'
import { getObjectUrl } from '../lib/media'

interface Props {
  id: string
  directUrl?: string // cloud: public URL; when set, used directly
  alt?: string
  className?: string
  onClick?: () => void
}

export default function MediaImage({ id, directUrl, alt, className, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(directUrl ?? null)

  useEffect(() => {
    if (directUrl) {
      setUrl(directUrl)
      return
    }
    let active = true
    let created: string | null = null
    getObjectUrl(id).then((u) => {
      if (active) {
        setUrl(u)
        created = u
      } else if (u) {
        URL.revokeObjectURL(u)
      }
    })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [id, directUrl])

  if (!url) {
    return <div className={`media-img media-placeholder ${className ?? ''}`} />
  }
  return (
    <img src={url} alt={alt ?? ''} className={`media-img ${className ?? ''}`} onClick={onClick} />
  )
}
