export type Id = string

export interface Section {
  id: Id
  name: string
  color: string
  createdAt: number
}

export interface Entry {
  id: Id
  sectionId: Id
  placeName: string
  address: string
  addressNotes: string
  lat: number | null
  lng: number | null
  managerName: string
  managerPhone: string
  activityType: string
  customActivity: string
  met: 'yes' | 'no' | ''
  meetingNotes: string
  targetCompany: string
  createdAt: number
  updatedAt: number
}

export interface AppData {
  sections: Section[]
  entries: Entry[]
  version: number
}

export const ACTIVITY_TYPES: string[] = [
  'مطعم',
  'كافيه / مقهى',
  'سوبر ماركت / بقالة',
  'صيدلية',
  'عيادة / مركز طبي',
  'مكتب عقاري',
  'شركة / مكتب إداري',
  'محل ملابس',
  'صالون تجميل / حلاقة',
  'ورشة / مركز صيانة سيارات',
  'مخبز / حلواني',
  'محل موبايلات / إلكترونيات',
  'مركز تعليمي / حضانة',
  'بنك / خدمات مالية',
  'شركة سياحة / سفر',
  'أخرى',
]

export const SECTION_COLORS = [
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#1d4ed8',
  '#15803d',
  '#a21caf',
  '#0e7490',
]
