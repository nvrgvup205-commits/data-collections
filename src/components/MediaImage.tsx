import { useEffect, useState } from 'react'
import { getObjectUrl } from '../lib/media'

interface Props {
  id: string
  alt?: string
  className?: string
  onClick?: () => void
}

export default function MediaImage({ id, alt, className, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
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
  }, [id])

  if (!url) {
    return <div className={`media-img media-placeholder ${className ?? ''}`} />
  }
  return (
    <img src={url} alt={alt ?? ''} className={`media-img ${className ?? ''}`} onClick={onClick} />
  )
}
