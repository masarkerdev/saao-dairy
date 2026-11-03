// পর্দার ফর্ম (প্রিন্টের মতো) হুবহু ছবি করে A4 আড়াআড়ি PDF বানানো।
// লেখা ১১px; এক পক্ষ এক পাতায় না আঁটলে সারির মাঝখানে না কেটে পরের পাতায় যায়,
// আর পরের পাতার শুরুতে টেবিলের মাথা (বার ও তারিখ, সময়…) আবার বসে।
import { nikoshReady } from './fonts'

const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 8

export async function sheetsToPdf(sheets: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  await nikoshReady()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const maxW = PAGE_W - MARGIN * 2
  const maxH = PAGE_H - MARGIN * 2
  let first = true

  for (const sheet of sheets) {
    const SCALE = 3
    const canvas = await html2canvas(sheet, { scale: SCALE, backgroundColor: '#ffffff', logging: false })
    const k = canvas.width / sheet.offsetWidth // CSS পিক্সেল → ছবির পিক্সেল
    const top = sheet.getBoundingClientRect().top
    const y = (el: Element) => Math.round((el.getBoundingClientRect().bottom - top) * k)

    // যেখানে কাটা যায়: টেবিলের প্রতিটি সারির নিচে, আর একদম শেষে (মন্তব্য ও সই একসাথে থাকে)
    const thead = sheet.querySelector('thead')
    const headTop = thead ? Math.round((thead.getBoundingClientRect().top - top) * k) : 0
    const headBottom = thead ? y(thead) : 0
    const cuts = Array.from(sheet.querySelectorAll('tbody > tr')).map(y)
    cuts.push(canvas.height)

    const pagePx = Math.floor((maxH / maxW) * canvas.width) // এক পাতায় কত উঁচু ছবি ধরে
    let start = 0
    let page = 0
    while (start < canvas.height - 1) {
      const head = page > 0 && thead ? headBottom - headTop : 0
      const room = pagePx - head
      let end = cuts.filter((c) => c > start && c - start <= room).pop()
      if (end === undefined) end = Math.min(start + room, canvas.height) // একটি সারিই পাতার চেয়ে বড় হলে
      const part = document.createElement('canvas')
      part.width = canvas.width
      part.height = head + (end - start)
      const ctx = part.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, part.width, part.height)
      if (head) ctx.drawImage(canvas, 0, headTop, canvas.width, head, 0, 0, canvas.width, head)
      ctx.drawImage(canvas, 0, start, canvas.width, end - start, 0, head, canvas.width, end - start)

      const w = maxW
      const h = (part.height / part.width) * w
      if (!first) pdf.addPage('a4', 'landscape')
      first = false
      pdf.addImage(part.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, w, h, undefined, 'FAST')
      start = end
      page++
    }
  }
  return pdf.output('blob')
}
