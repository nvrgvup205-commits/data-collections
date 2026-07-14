export type Id = string

export interface Section {
  id: Id
  name: string
  color: string
  createdAt: number
}

export interface PhotoRef {
  id: Id
  capturedAt: number
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
  audioNote: string
  photos: PhotoRef[]
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
  'مطعم وجبات سريعة',
  'كافيه / مقهى',
  'عصائر ومثلجات',
  'مخبز / حلواني',
  'سوبر ماركت / بقالة',
  'محل تموينات / أسواق مركزية',
  'صيدلية',
  'عيادة / مجمع طبي',
  'مستشفى / مختبر وأشعة',
  'مركز أسنان',
  'صالون حلاقة رجالي',
  'صالون تجميل / سبا نسائي',
  'محل ملابس / أزياء',
  'محل أحذية وحقائب',
  'محل عطور ومستحضرات تجميل',
  'محل موبايلات وإكسسوارات',
  'محل إلكترونيات وأجهزة',
  'ورشة / مركز صيانة سيارات',
  'معرض سيارات / تأجير سيارات',
  'محطة وقود',
  'مكتب عقاري',
  'شركة مقاولات / تشطيبات',
  'شركة / مكتب إداري',
  'بنك / صرافة / خدمات مالية',
  'شركة سياحة وسفر',
  'فندق / شقق مفروشة',
  'مركز تعليمي / معهد تدريب',
  'حضانة / روضة أطفال',
  'نادي رياضي / صالة جيم',
  'محل زهور وهدايا',
  'مغسلة ملابس / خدمات تنظيف',
  'محل حيوانات أليفة / بيطري',
  'مكتبة وقرطاسية',
  'محل أدوات رياضية',
  'محل أثاث ومفروشات',
  'محل مواد بناء وأدوات',
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
