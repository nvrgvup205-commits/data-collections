import { googleMapEmbedUrl, googleMapLink } from '../lib/geo'

interface Props {
  lat: number | null
  lng: number | null
}

export default function MapPreview({ lat, lng }: Props) {
  if (lat == null || lng == null) {
    return (
      <div className="map-placeholder">
        اضغط «تحديد موقعي على الخريطة» لعرض خريطة جوجل الفعلية للمكان.
      </div>
    )
  }
  const coords = { lat, lng }
  return (
    <div className="map-wrap">
      <iframe
        title="خريطة جوجل"
        className="map-frame"
        src={googleMapEmbedUrl(coords)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        className="map-link"
        href={googleMapLink(coords)}
        target="_blank"
        rel="noreferrer"
      >
        فتح في خرائط جوجل ({lat.toFixed(5)}, {lng.toFixed(5)})
      </a>
    </div>
  )
}
