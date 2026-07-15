import { useEffect, useState } from 'react'
import {
  CompanyMeta,
  companyShareUrl,
  fetchCompaniesFromDb,
  listLocalCompanies,
  saveCompanyMeta,
  updateCompanyCredentials,
} from '../lib/companies'

interface Props {
  onClose: () => void
}

export default function CompaniesManager({ onClose }: Props) {
  const [rows, setRows] = useState<CompanyMeta[]>([])
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { username: string; password: string }>>({})

  const reload = async () => {
    const fromDb = await fetchCompaniesFromDb()
    const map = new Map<string, CompanyMeta>()
    for (const c of listLocalCompanies()) map.set(c.slug, c)
    for (const c of fromDb) map.set(c.slug, c)
    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    setRows(list)
    const d: Record<string, { username: string; password: string }> = {}
    for (const c of list) d[c.slug] = { username: c.username, password: c.password }
    setDrafts(d)
  }

  useEffect(() => {
    void reload()
  }, [])

  const saveRow = async (slug: string) => {
    const draft = drafts[slug]
    if (!draft) return
    setSavingSlug(slug)
    setMessage('')
    try {
      await updateCompanyCredentials(slug, {
        username: draft.username,
        password: draft.password,
      })
      setMessage('تم تحديث بيانات الدخول ورابط البوابة.')
      await reload()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setSavingSlug(null)
    }
  }

  const copyLink = async (slug: string) => {
    const url = companyShareUrl(slug)
    try {
      await navigator.clipboard.writeText(url)
      setMessage('تم نسخ رابط البوابة.')
    } catch {
      prompt('انسخ الرابط:', url)
    }
  }

  const addCompany = async () => {
    const name = prompt('اسم الشركة الجديدة')
    if (!name?.trim()) return
    const slug = prompt('الـ slug للرابط (مثال: hanqoul)', name.trim().toLowerCase().replace(/\s+/g, '-'))
    if (!slug?.trim()) return
    const username = prompt('اسم مستخدم بوابة الشركة', '1111')
    if (!username?.trim()) return
    const password = prompt('كلمة مرور بوابة الشركة', '1111')
    if (!password?.trim()) return
    try {
      await saveCompanyMeta({ name, slug, username, password })
      setMessage('تم إنشاء بوابة الشركة.')
      await reload()
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal companies-manager-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h2>إدارة بوابات الشركات</h2>
          <button className="btn ghost small" onClick={onClose}>
            إغلاق
          </button>
        </div>
        <p className="muted">
          كل شركة لها رابط خاص <code dir="ltr">/#/p/slug</code> ومستخدم/كلمة مرور تحدّدهما هنا.
        </p>
        {message && <p className="hint">{message}</p>}

        <div className="companies-list">
          {rows.map((c) => (
            <div className="company-admin-card" key={c.slug}>
              <div className="company-admin-head">
                <strong>{c.name}</strong>
                <code dir="ltr">{companyShareUrl(c.slug)}</code>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>اسم المستخدم</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={drafts[c.slug]?.username ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [c.slug]: { ...prev[c.slug], username: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>كلمة المرور</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={drafts[c.slug]?.password ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [c.slug]: { ...prev[c.slug], password: e.target.value },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="card-actions">
                <button
                  className="btn primary small"
                  disabled={savingSlug === c.slug}
                  onClick={() => void saveRow(c.slug)}
                >
                  {savingSlug === c.slug ? 'جارٍ الحفظ...' : 'حفظ بيانات الدخول'}
                </button>
                <button className="btn secondary small" onClick={() => void copyLink(c.slug)}>
                  نسخ الرابط
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn primary" onClick={() => void addCompany()}>
            + شركة / بوابة جديدة
          </button>
          <button className="btn ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
