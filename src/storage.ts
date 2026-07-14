import { AppData, Section, SECTION_COLORS } from './types'

const STORAGE_KEY = 'field-research-data-v1'

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

function defaultSections(): Section[] {
  const now = Date.now()
  return [
    { id: uid(), name: 'مطاعم وكافيهات', color: SECTION_COLORS[0], createdAt: now },
    { id: uid(), name: 'شركات', color: SECTION_COLORS[1], createdAt: now + 1 },
  ]
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.entries)) {
        return parsed
      }
    }
  } catch {
    // ignore corrupt storage and fall back to defaults
  }
  return { sections: defaultSections(), entries: [], version: 1 }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('تعذر حفظ البيانات محليًا', e)
  }
}
