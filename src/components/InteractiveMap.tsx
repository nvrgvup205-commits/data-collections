import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getCurrentPosition, googleMapLink } from '../lib/geo'

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

// Default center: Riyadh, KSA — used until the user picks a location.
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]

const pinIcon = L.divIcon({
  className: 'leaflet-pin-icon',
  html: '<div class="pin-marker">📍</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 32],
})

export default function InteractiveMap({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const [locating, setLocating] = useState(false)
  const [msg, setMsg] = useState('')

  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const start: [number, number] =
      lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

    const map = L.map(containerRef.current, {
      center: start,
      zoom: lat != null ? 16 : 12,
      zoomControl: true,
      // Avoid hijacking page scroll; zoom via +/- buttons or pinch instead.
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    const marker = L.marker(start, { draggable: true, icon: pinIcon }).addTo(map)

    marker.on('dragend', () => {
      const p = marker.getLatLng()
      onChangeRef.current(p.lat, p.lng)
    })
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onChangeRef.current(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map
    markerRef.current = marker

    // Leaflet needs a size recalculation once the container is laid out.
    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync marker/view when coordinates change from outside (e.g. GPS button).
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current || !markerRef.current) return
    const current = markerRef.current.getLatLng()
    if (Math.abs(current.lat - lat) > 1e-7 || Math.abs(current.lng - lng) > 1e-7) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16))
    }
  }, [lat, lng])

  const locate = async () => {
    setLocating(true)
    setMsg('جارٍ تحديد موقعك...')
    try {
      const coords = await getCurrentPosition()
      onChangeRef.current(coords.lat, coords.lng)
      setMsg('تم تحديد موقعك. يمكنك سحب الدبوس لضبطه بدقة.')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="imap">
      <div className="imap-toolbar">
        <button
          type="button"
          className="btn secondary small"
          onClick={locate}
          disabled={locating}
        >
          {locating ? 'جارٍ التحديد...' : '📍 تحديد موقعي تلقائيًا'}
        </button>
        {lat != null && lng != null && (
          <a
            className="imap-link"
            href={googleMapLink({ lat, lng })}
            target="_blank"
            rel="noreferrer"
          >
            فتح في خرائط جوجل
          </a>
        )}
      </div>
      <div ref={containerRef} className="imap-canvas" />
      <p className="hint muted imap-hint">
        اضغط على أي مكان في الخريطة أو اسحب الدبوس 📍 لتغيير الموقع في أي وقت.
        {lat != null && lng != null && (
          <span dir="ltr"> ({lat.toFixed(5)}, {lng.toFixed(5)})</span>
        )}
      </p>
      {msg && <p className="hint muted">{msg}</p>}
    </div>
  )
}
