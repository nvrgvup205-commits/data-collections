export interface Coords {
  lat: number
  lng: number
}

export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'تم رفض إذن الوصول للموقع. فعّل الإذن من إعدادات المتصفح.'
    case err.POSITION_UNAVAILABLE:
      return 'تعذر تحديد الموقع حاليًا.'
    case err.TIMEOUT:
      return 'انتهى وقت محاولة تحديد الموقع.'
    default:
      return 'حدث خطأ أثناء تحديد الموقع.'
  }
}

// Reverse geocoding using the free OpenStreetMap Nominatim service (no API key required).
export async function reverseGeocode(coords: Coords): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&accept-language=ar`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('تعذر جلب العنوان من الخريطة')
  const data = (await res.json()) as { display_name?: string }
  return data.display_name ?? ''
}

// Google Maps embed (no API key needed) centered on the coordinates.
export function googleMapEmbedUrl(coords: Coords): string {
  const { lat, lng } = coords
  return `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`
}

export function googleMapLink(coords: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
}
