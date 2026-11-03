// মাসের সূচি Word (.docx) ফাইলে: পর্দার ফর্মের একই কাঠামো, Word-এ খুলে সম্পাদনা করা যায়।
// প্রতি পক্ষ নতুন পাতায় শুরু (A4 আড়াআড়ি); লেখা ১১px-এর সমান (৮.৫ পয়েন্ট), না আঁটলে পরের পাতায় যায়, টেবিলের মাথা আবার বসে।
// ফন্ট: Nikosh, ফাইলের ভেতরে ঢোকানো থাকে, তাই যে কম্পিউটারে Nikosh নেই সেখানেও একই দেখায়।
import { WEEKDAYS, bn, dayKind, dow, fmtDate, toISO } from './period'
import type { MonthData, PokkhoPage } from './month'
import { displayNumbers, g2 } from './schedules'
import { printAddress } from './catalog'
import { nikoshBytes } from './fonts'

const FONT = 'Nikosh'
const PAGE_W = 16838 // A4 লম্বা দিক, টুইপ
const PAGE_H = 11906
const MARGIN_X = 454 // ৮ মিমি
const MARGIN_Y = 340 // ৬ মিমি
const USABLE_W = PAGE_W - MARGIN_X * 2
const COLS = [10, 13.5, 23, 13.5, 23, 17].map((p) => Math.round((USABLE_W * p) / 100))
const SZ = 17 // অর্ধ-পয়েন্ট: ৮.৫ পয়েন্ট ≈ ১১px
const LINE = 220 // লাইনের উচ্চতা ঠিক ১১ পয়েন্ট (যেকোনো ফন্টে এক মাপ)
const SUNDAY_WORK = 'কৃষক সভা, প্রকল্প কাজ, প্রদর্শনী স্থাপন ও অন্যান্য কাজ'
const TOPIC_NO = ['১', '২', '৩', '৪', '৫']

export async function monthToDocx(m: MonthData, signer: string[], heading = 'উপসহকারী কৃষি কর্মকর্তাগণের পাক্ষিক ভ্রমণসূচী'): Promise<Blob> {
  const d = await import('docx')
  const {
    AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, Tab, TabStopType, Table, TableCell,
    TableLayoutType, TableRow, TextRun, VerticalAlignTable, VerticalMergeType, WidthType, LineRuleType,
  } = d

  type Run = InstanceType<typeof TextRun>
  type Para = InstanceType<typeof Paragraph>
  type Cell = InstanceType<typeof TableCell>

  const run = (text: string, o: { bold?: boolean; strike?: boolean; size?: number } = {}): Run =>
    new TextRun({ text, font: FONT, size: o.size ?? SZ, bold: o.bold, strike: o.strike })
  const para = (children: Run[] | string, o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; size?: number } = {}): Para =>
    new Paragraph({
      alignment: o.align,
      spacing: { before: 0, after: 0, line: LINE, lineRule: LineRuleType.EXACT },
      children: typeof children === 'string' ? [run(children, { bold: o.bold, size: o.size })] : children,
    })

  const line = { style: BorderStyle.SINGLE, size: 6, color: '000000' }
  const borders = { top: line, bottom: line, left: line, right: line }
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }

  const cell = (
    children: Para[],
    o: { span?: number; vMerge?: 'restart' | 'continue'; col: number; center?: boolean } ,
  ): Cell => {
    const width = COLS.slice(o.col, o.col + (o.span ?? 1)).reduce((a, b) => a + b, 0)
    return new TableCell({
      children: children.length ? children : [para('')],
      columnSpan: o.span,
      verticalMerge: o.vMerge === 'restart' ? VerticalMergeType.RESTART : o.vMerge === 'continue' ? VerticalMergeType.CONTINUE : undefined,
      verticalAlign: o.center ? VerticalAlignTable.CENTER : VerticalAlignTable.TOP,
      width: { size: width, type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 50, right: 50 },
      borders,
    })
  }
  const head = (text: string) => [para(text, { align: AlignmentType.CENTER, bold: true })]

  function pageChildren(page: PokkhoPage) {
    const displayNo = displayNumbers(page.groups)
    const at: Record<string, { 1?: number; 2?: number }> = {}
    for (const [k, g] of Object.entries(page.groups)) {
      if (g.visit_date && g.slot) at[g.visit_date] = { ...(at[g.visit_date] ?? {}), [g.slot]: Number(k) }
    }
    const dayParas = (dt: string) => {
      const out = [para(WEEKDAYS[dow(dt)], { bold: true }), para(fmtDate(dt))]
      if (m.holidays[dt] && at[dt]) out.push(para(`(${m.holidays[dt]})`))
      return out
    }
    // গ্রুপ নেই এমন দিনে বার ও তারিখ এক লাইনে, যাতে পুরো পক্ষ এক পাতায় আঁটে
    const dayLine = (dt: string) => [para([run(WEEKDAYS[dow(dt)], { bold: true }), run(` ${fmtDate(dt)}`)])]
    const infoParas = (no?: number) => {
      if (no === undefined) return []
      const g = page.groups[no]
      const out = [para(`গ্রুপ নং -${g2(displayNo[no] ?? no)}`)]
      if (g?.group_name) out.push(para(g.group_name))
      if (g?.president) out.push(para(`সভাপতি: ${g.president}`))
      if (g?.address && printAddress(g.address)) out.push(para(printAddress(g.address)))
      if (g?.mobile) out.push(para(`মোবাইল: ${bn(g.mobile)}`))
      return out
    }
    const topicParas = (no: number | undefined, show: boolean) =>
      show ? TOPIC_NO.map((n, i) => para(`${n}।  ${no !== undefined ? page.groups[no]?.topics[i] ?? '' : ''}`)) : []

    const rows: InstanceType<typeof TableRow>[] = [
      new TableRow({ tableHeader: true, children: [
        cell(head('বার ও তারিখ'), { col: 0, vMerge: 'restart', center: true }),
        cell(head(page.label), { col: 1, span: 5, center: true }),
      ] }),
      new TableRow({ tableHeader: true, children: [
        cell([], { col: 0, vMerge: 'continue' }),
        cell(head('কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর'), { col: 1, vMerge: 'restart', center: true }),
        cell(head('৯.০০-১১.৩০'), { col: 2, center: true }),
        cell(head('কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর'), { col: 3, vMerge: 'restart', center: true }),
        cell(head('১২.৩০-৩.০০'), { col: 4, center: true }),
        cell(head('৩.০০-৫.০০'), { col: 5, center: true }),
      ] }),
      new TableRow({ tableHeader: true, children: [
        cell([], { col: 0, vMerge: 'continue' }),
        cell([], { col: 1, vMerge: 'continue' }),
        cell(head('কৃষক গ্রুপে আলোচ্য বিষয়'), { col: 2, center: true }),
        cell([], { col: 3, vMerge: 'continue' }),
        cell(head('কৃষক গ্রুপে আলোচ্য বিষয়'), { col: 4, center: true }),
        cell(head('কৃষি তথ্য ও পরামর্শ কেন্দ্র'), { col: 5, center: true }),
      ] }),
    ]

    for (const dt of page.dates) {
      if (at[dt]) {
        const a = at[dt][1]
        const b = at[dt][2]
        rows.push(new TableRow({ cantSplit: true, children: [
          cell(dayParas(dt), { col: 0 }),
          cell(infoParas(a), { col: 1 }),
          cell(topicParas(a, true), { col: 2 }),
          cell(infoParas(b), { col: 3 }),
          cell(topicParas(b, true), { col: 4 }),
          cell(page.notes[dt] ? [para(page.notes[dt])] : [], { col: 5 }),
        ] }))
        continue
      }
      const full = (text: string) => new TableRow({ cantSplit: true, children: [
        cell(dayLine(dt), { col: 0 }), cell([para(text)], { col: 1, span: 5, center: true }),
      ] })
      switch (dayKind(dt, m.holidays)) {
        case 'holiday': rows.push(full(`সরকারি ছুটি (${m.holidays[dt]})`)); break
        case 'meeting': rows.push(full('উপজেলা অফিসে সাপ্তাহিক সভা')); break
        case 'sunday': rows.push(full(SUNDAY_WORK)); break
        case 'weekend':
          rows.push(new TableRow({ cantSplit: true, children: [
            cell(dayLine(dt), { col: 0 }), cell([para('সাপ্তাহিক ছুটি')], { col: 1, center: true }),
            cell([], { col: 2 }), cell([], { col: 3 }), cell([], { col: 4 }), cell([], { col: 5 }),
          ] }))
          break
        default: rows.push(full('মাঠ পরিদর্শন ও অন্যান্য কাজ'))
      }
    }

    const f = page.period.fortnight
    const s = page.schedule
    const approved = s?.status === 'approved' && s.approved_at ? `অনলাইনে অনুমোদিত: ${fmtDate(toISO(new Date(s.approved_at)))}` : ''

    const title = new Paragraph({
      spacing: { before: 0, after: 40 },
      tabStops: [{ type: TabStopType.CENTER, position: Math.round(USABLE_W / 2) }, { type: TabStopType.RIGHT, position: USABLE_W }],
      children: [
        run(heading, { bold: true, size: 19 }),
        new TextRun({ children: [new Tab(), `মাসের নামঃ ${m.monthName}`], font: FONT, size: 19, bold: true }),
        new TextRun({ children: [new Tab(), 'পক্ষঃ '], font: FONT, size: 19, bold: true }),
        run('১ম পক্ষ', { bold: true, size: 19, strike: f !== 1 }),
        run('/ ', { bold: true, size: 19 }),
        run('২য় পক্ষ', { bold: true, size: 19, strike: f !== 2 }),
      ],
    })

    const table = new Table({ rows, columnWidths: COLS, layout: TableLayoutType.FIXED, width: { size: USABLE_W, type: WidthType.DXA } })
    const note = para('নামাজ ও মধ্যাহ্ন বিরতিসহ', { align: AlignmentType.CENTER })

    const sigLeft = [para('অনুমোদনকারী কর্মকর্তার স্বাক্ষর ও সীল', { size: 18 })]
    if (approved) sigLeft.push(para(approved))
    const sigRight = [para('দাখিলকারী এসএএও এর স্বাক্ষর ও সীল', { align: AlignmentType.CENTER, size: 18 }),
      ...signer.map((x) => para(x, { align: AlignmentType.CENTER, size: 17 }))]
    const half = Math.round(USABLE_W / 2)
    const sig = new Table({
      columnWidths: [half, USABLE_W - half], layout: TableLayoutType.FIXED, width: { size: USABLE_W, type: WidthType.DXA }, borders: noBorders,
      rows: [new TableRow({ children: [
        new TableCell({ children: sigLeft, width: { size: half, type: WidthType.DXA }, borders: noBorders }),
        new TableCell({ children: sigRight, width: { size: USABLE_W - half, type: WidthType.DXA }, borders: noBorders }),
      ] })],
    })
    return [title, table, note, new Paragraph({ spacing: { before: 0, after: 0, line: 300, lineRule: LineRuleType.EXACT }, children: [] }), sig]
  }

  const nikosh = await nikoshBytes()
  const doc = new Document({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(nikosh ? { fonts: [{ name: FONT, data: nikosh as any }] } : {}),
    creator: 'পাক্ষিক ভ্রমণসূচী',
    title: `পাক্ষিক ভ্রমণসূচী ${m.monthName} ${m.year}`,
    styles: { default: { document: { run: { font: FONT, size: SZ } } } },
    sections: m.pages.map((page) => ({
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: PAGE_H, height: PAGE_W },
          margin: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X, header: 0, footer: 0 },
        },
      },
      children: pageChildren(page),
    })),
  })
  return Packer.toBlob(doc)
}
