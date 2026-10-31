// পর্দার ফর্ম (প্রিন্টের মতো) হুবহু ছবি করে A4 আড়াআড়ি PDF বানানো।
// ব্রাউজারের প্রিন্ট সেটিংসের ওপর নির্ভর নেই, তাই মার্জিনে লেখা কাটে না।
const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 8

export async function sheetsToPdf(sheets: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  if (document.fonts?.ready) await document.fonts.ready
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const maxW = PAGE_W - MARGIN * 2
  const maxH = PAGE_H - MARGIN * 2
  for (let i = 0; i < sheets.length; i++) {
    const canvas = await html2canvas(sheets[i], { scale: 3, backgroundColor: '#ffffff', logging: false })
    let w = maxW
    let h = (canvas.height / canvas.width) * w
    if (h > maxH) { w = (maxH / h) * w; h = maxH }
    if (i > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN + (maxW - w) / 2, MARGIN, w, h, undefined, 'FAST')
  }
  return pdf.output('blob')
}
