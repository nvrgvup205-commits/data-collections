export type Id = string

export interface Section {
  id: Id
  name: string
  color: string
  createdAt: number
}

export interface PhotoRef {
  id: Id // local: IndexedDB key; cloud: Storage object path
  capturedAt: number
  url?: string // cloud: public URL for display
}

/** نتيجة الزيارة / موقف العميل من الفكرة */
export type DealStatus = 'purchased' | 'rejected' | 'objections' | 'follow_up' | ''

export const DEAL_STATUS_OPTIONS: { value: Exclude<DealStatus, ''>; label: string }[] = [
  { value: 'purchased', label: 'مشتري بالفعل' },
  { value: 'objections', label: 'عنده اعتراضات يمكن حلها' },
  { value: 'rejected', label: 'رافض الفكرة تماما' },
  { value: 'follow_up', label: 'يعاود التواصل معها أو زيارتها' },
]

export function dealStatusLabel(status: DealStatus | undefined): string {
  if (!status) return ''
  return DEAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? ''
}

/** حالة المقابلة / التواصل */
export type MetStatus = 'yes' | 'no' | 'phone_answered' | 'phone_no_answer' | ''

export const MET_STATUS_OPTIONS: { value: Exclude<MetStatus, ''>; label: string }[] = [
  { value: 'yes', label: 'تمت المقابلة' },
  { value: 'no', label: 'لم تتم المقابلة' },
  { value: 'phone_answered', label: 'تم التواصل هاتفيًا — ورد' },
  { value: 'phone_no_answer', label: 'تم التواصل هاتفيًا — لم يرد' },
]

export function metStatusLabel(status: MetStatus | undefined): string {
  if (!status) return 'المقابلة غير محددة'
  return MET_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'المقابلة غير محددة'
}

/** تسمية العميل بعد الزيارة الميدانية */
export const VISITED_CLIENT_LABEL = 'عميل تمت زيارته'

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
  met: MetStatus
  meetingNotes: string
  /** موقف العميل: مشتري / اعتراضات / رافض / يعاد التواصل */
  dealStatus: DealStatus
  /** أسباب الرفض (عند اختيار رافض الفكرة تماما) */
  rejectionReason: string
  /** رابط تتبع مختصر يُرسل للشركة */
  slug: string
  /** بيانات دخول المكان (للشركة) */
  placeUsername: string
  placePassword: string
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

// Suggested companies always available for selection (even before any report exists).
export const KNOWN_COMPANIES: string[] = ['سعودي تريند', 'شركة نخبة التسويق']

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
