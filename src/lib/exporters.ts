import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Entry, Section } from '../types'

export interface ExportMeta {
  targetCompany: string
  researcher: string
}

function activityLabel(e: Entry): string {
  if (e.activityType === 'أخرى' && e.customActivity.trim()) {
    return e.customActivity.trim()
  }
  return e.activityType
}

function sectionName(sections: Section[], id: string): string {
  return sections.find((s) => s.id === id)?.name ?? '-'
}

export function exportExcel(
  entries: Entry[],
  sections: Section[],
  meta: ExportMeta,
): void {
  const rows = entries.map((e, i) => ({
    'م': i + 1,
    'القسم': sectionName(sections, e.sectionId),
    'اسم المكان': e.placeName,
    'نوع النشاط': activityLabel(e),
    'العنوان': e.address,
    'ملاحظات العنوان': e.addressNotes,
    'الإحداثيات': e.lat != null && e.lng != null ? `${e.lat}, ${e.lng}` : '',
    'اسم المدير': e.managerName,
    'رقم الجوال': e.managerPhone,
    'تمت المقابلة؟': e.met === 'yes' ? 'نعم' : e.met === 'no' ? 'لا' : '',
    'ملخص المقابلة': e.meetingNotes,
    'التاريخ': new Date(e.createdAt).toLocaleString('ar-EG'),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 4 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 32 },
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
    { wch: 40 }, { wch: 20 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'البحث الميداني')

  const fileName = buildFileName(meta, 'xlsx')
  XLSX.writeFile(wb, fileName)
}

function buildFileName(meta: ExportMeta, ext: string): string {
  const base = meta.targetCompany.trim()
    ? `بحث_${meta.targetCompany.trim()}`
    : 'بحث_ميداني'
  const date = new Date().toISOString().slice(0, 10)
  return `${base}_${date}.${ext}`.replace(/\s+/g, '_')
}

function buildReportHtml(
  entries: Entry[],
  sections: Section[],
  meta: ExportMeta,
): HTMLElement {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;top:-10000px;right:0;width:794px;padding:32px;background:#fff;color:#111;font-family:system-ui,"Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;'

  const dateStr = new Date().toLocaleString('ar-EG')
  const header = `
    <div style="border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:18px;">
      <h1 style="margin:0;font-size:24px;color:#0f766e;">تقرير بحث ميداني</h1>
      ${meta.targetCompany.trim() ? `<p style="margin:6px 0 0;font-size:16px;">بحث موجّه إلى: <strong>${escapeHtml(meta.targetCompany)}</strong></p>` : ''}
      ${meta.researcher.trim() ? `<p style="margin:4px 0 0;font-size:14px;color:#555;">إعداد الباحث: ${escapeHtml(meta.researcher)}</p>` : ''}
      <p style="margin:4px 0 0;font-size:12px;color:#777;">تاريخ التصدير: ${dateStr} — عدد الأماكن: ${entries.length}</p>
    </div>`

  const cards = entries
    .map((e, i) => {
      const met =
        e.met === 'yes' ? 'نعم' : e.met === 'no' ? 'لا' : 'غير محدد'
      const coords =
        e.lat != null && e.lng != null ? `${e.lat.toFixed(6)}, ${e.lng.toFixed(6)}` : '-'
      return `
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;background:#f8fafc;page-break-inside:avoid;">
        <h2 style="margin:0 0 8px;font-size:17px;color:#0f172a;">${i + 1}. ${escapeHtml(e.placeName) || 'بدون اسم'}
          <span style="font-size:12px;color:#0f766e;font-weight:normal;">(${escapeHtml(sectionName(sections, e.sectionId))})</span>
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${row('نوع النشاط', activityLabel(e))}
          ${row('العنوان', e.address)}
          ${row('ملاحظات العنوان', e.addressNotes)}
          ${row('الإحداثيات', coords)}
          ${row('اسم المدير', e.managerName)}
          ${row('رقم الجوال', e.managerPhone)}
          ${row('تمت المقابلة؟', met)}
          ${row('ملخص المقابلة', e.meetingNotes)}
        </table>
      </div>`
    })
    .join('')

  container.innerHTML = header + (cards || '<p>لا توجد بيانات.</p>')
  return container
}

function row(label: string, value: string): string {
  if (!value || !value.trim()) return ''
  return `<tr>
    <td style="padding:4px 8px;vertical-align:top;color:#64748b;width:130px;font-weight:600;">${label}</td>
    <td style="padding:4px 8px;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function exportPdf(
  entries: Entry[],
  sections: Section[],
  meta: ExportMeta,
): Promise<void> {
  const node = buildReportHtml(entries, sections, meta)
  document.body.appendChild(node)
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    const imgData = canvas.toDataURL('image/png')

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position -= pageHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(buildFileName(meta, 'pdf'))
  } finally {
    document.body.removeChild(node)
  }
}
