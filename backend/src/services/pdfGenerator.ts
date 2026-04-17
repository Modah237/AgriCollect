import PDFDocument from 'pdfkit'

export interface ReportData {
  gicName: string
  campaignName: string
  campaignStart: Date
  campaignEnd: Date | null
  exportedAt: Date
  deliveries: Array<{
    producerName: string
    culture: string
    qualityGrade: string
    quantityKg: number
    pricePerKg: number
    calculatedAmount: number
    advanceDeducted: number
    netDue: number
    createdAt: Date
  }>
}

// ─── Couleurs et constantes ───────────────────────────────────────────────────

const GREEN = '#1C3D1A'
const LIGHT_GREEN = '#E8F5E9'
const GRAY = '#666666'
const LIGHT_GRAY = '#F5F5F5'
const BLACK = '#111111'

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
}

function formatKg(kg: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(kg) + ' kg'
}

// ─── Génération PDF ───────────────────────────────────────────────────────────

export function generateCampaignPDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, compress: true })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = PAGE_WIDTH - MARGIN * 2

    // ── En-tête ───────────────────────────────────────────────────────────────
    doc
      .rect(0, 0, PAGE_WIDTH, 100)
      .fill(GREEN)

    doc
      .fillColor('white')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('AgriCollect CM', MARGIN, 25)
      .fontSize(11)
      .font('Helvetica')
      .text('Rapport de campagne agricole', MARGIN, 52)

    doc
      .fontSize(10)
      .text(`Exporté le ${formatDate(data.exportedAt)}`, MARGIN, 72)

    // ── Infos campagne ────────────────────────────────────────────────────────
    doc.moveDown(2)
    const infoY = 120

    doc
      .rect(MARGIN, infoY, contentWidth, 60)
      .fill(LIGHT_GREEN)

    doc
      .fillColor(GREEN)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(data.gicName, MARGIN + 12, infoY + 10)

    doc
      .fillColor(GRAY)
      .font('Helvetica')
      .fontSize(10)
      .text(
        `Campagne : ${data.campaignName}   |   Début : ${formatDate(data.campaignStart)}` +
        (data.campaignEnd ? `   |   Fin : ${formatDate(data.campaignEnd)}` : '   |   En cours'),
        MARGIN + 12,
        infoY + 32,
      )

    // ── Totaux récapitulatifs ─────────────────────────────────────────────────
    const totalKg = data.deliveries.reduce((s, d) => s + d.quantityKg, 0)
    const totalBrut = data.deliveries.reduce((s, d) => s + d.calculatedAmount, 0)
    const totalAvances = data.deliveries.reduce((s, d) => s + d.advanceDeducted, 0)
    const totalNet = data.deliveries.reduce((s, d) => s + d.netDue, 0)
    const nbProducteurs = new Set(data.deliveries.map((d) => d.producerName)).size

    const statsY = infoY + 80
    const colW = contentWidth / 4

    const stats = [
      { label: 'Livraisons', value: String(data.deliveries.length) },
      { label: 'Tonnage total', value: formatKg(totalKg) },
      { label: 'Montant brut', value: formatXAF(totalBrut) },
      { label: 'Net à payer', value: formatXAF(totalNet) },
    ]

    stats.forEach((stat, i) => {
      const x = MARGIN + i * colW
      doc
        .rect(x, statsY, colW - 4, 55)
        .fill(i % 2 === 0 ? LIGHT_GRAY : 'white')
        .strokeColor('#DDDDDD')
        .lineWidth(0.5)
        .rect(x, statsY, colW - 4, 55)
        .stroke()

      doc
        .fillColor(GRAY)
        .font('Helvetica')
        .fontSize(8)
        .text(stat.label, x + 8, statsY + 8)

      doc
        .fillColor(GREEN)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(stat.value, x + 8, statsY + 24, { width: colW - 16 })
    })

    // note avances
    if (totalAvances > 0) {
      doc
        .fillColor(GRAY)
        .font('Helvetica')
        .fontSize(8)
        .text(`Avances déduites : ${formatXAF(totalAvances)}   |   Producteurs actifs : ${nbProducteurs}`, MARGIN, statsY + 65)
    }

    // ── Tableau des livraisons ─────────────────────────────────────────────────
    const tableY = statsY + (totalAvances > 0 ? 90 : 75)
    const colWidths = [110, 55, 45, 60, 65, 75, 75]
    const headers = ['Producteur', 'Culture', 'Grade', 'Poids (kg)', 'Prix/kg', 'Brut (XAF)', 'Net (XAF)']

    // En-tête tableau
    doc
      .rect(MARGIN, tableY, contentWidth, 22)
      .fill(GREEN)

    let xPos = MARGIN
    headers.forEach((h, i) => {
      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(h, xPos + 4, tableY + 7, { width: colWidths[i] - 4, align: i >= 3 ? 'right' : 'left' })
      xPos += colWidths[i]
    })

    // Lignes de données
    let rowY = tableY + 22
    const ROW_H = 18

    data.deliveries.forEach((d, idx) => {
      // Vérifier si on a besoin d'une nouvelle page
      if (rowY + ROW_H > doc.page.height - MARGIN - 60) {
        doc.addPage()
        rowY = MARGIN

        // Répéter l'en-tête sur la nouvelle page
        doc
          .rect(MARGIN, rowY, contentWidth, 22)
          .fill(GREEN)

        let xh = MARGIN
        headers.forEach((h, i) => {
          doc
            .fillColor('white')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(h, xh + 4, rowY + 7, { width: colWidths[i] - 4, align: i >= 3 ? 'right' : 'left' })
          xh += colWidths[i]
        })
        rowY += 22
      }

      const bg = idx % 2 === 0 ? 'white' : LIGHT_GRAY
      doc.rect(MARGIN, rowY, contentWidth, ROW_H).fill(bg)

      const row = [
        d.producerName,
        d.culture,
        d.qualityGrade,
        new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(d.quantityKg),
        new Intl.NumberFormat('fr-FR').format(d.pricePerKg),
        new Intl.NumberFormat('fr-FR').format(d.calculatedAmount),
        new Intl.NumberFormat('fr-FR').format(d.netDue),
      ]

      let rx = MARGIN
      row.forEach((cell, i) => {
        doc
          .fillColor(BLACK)
          .font('Helvetica')
          .fontSize(8)
          .text(cell, rx + 4, rowY + 5, {
            width: colWidths[i] - 8,
            align: i >= 3 ? 'right' : 'left',
            ellipsis: true,
          })
        rx += colWidths[i]
      })

      // Ligne séparatrice légère
      doc
        .strokeColor('#DDDDDD')
        .lineWidth(0.3)
        .moveTo(MARGIN, rowY + ROW_H)
        .lineTo(MARGIN + contentWidth, rowY + ROW_H)
        .stroke()

      rowY += ROW_H
    })

    // ── Pied de page ──────────────────────────────────────────────────────────
    const footerY = doc.page.height - 40

    doc
      .rect(0, footerY - 5, PAGE_WIDTH, 45)
      .fill(LIGHT_GRAY)

    doc
      .fillColor(GRAY)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `AgriCollect CM · Rapport généré le ${formatDate(data.exportedAt)} · Données confidentielles`,
        MARGIN,
        footerY + 5,
        { align: 'center', width: contentWidth },
      )

    doc.end()
  })
}

export interface TicketData {
  gicName: string
  producerName: string
  culture: string
  qualityGrade: string
  quantityKg: number
  pricePerKg: number
  calculatedAmount: number
  advanceDeducted: number
  netDue: number
  createdAt: Date
  reference: string
}

export function generateDeliveryTicketPDF(data: TicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Format portrait plus petit (type reçu/A6-ish)
    const doc = new PDFDocument({ size: [280, 420], margin: 20 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 280

    // Header
    doc.rect(0, 0, W, 60).fill(GREEN)
    doc.fillColor('white').font('Helvetica-Bold').fontSize(14).text('BORDEREAU DE PESÉE', 20, 15)
    doc.fontSize(8).font('Helvetica').text(data.gicName, 20, 35)

    // Body
    doc.fillColor(BLACK).moveDown(3)
    doc.fontSize(7).fillColor(GRAY).text('RÉFÉRENCE', 20)
    doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold').text(data.reference, 20)

    doc.moveDown()
    doc.fontSize(7).fillColor(GRAY).text('PRODUCTEUR', 20)
    doc.fontSize(10).fillColor(BLACK).text(data.producerName, 20)

    doc.moveDown(0.5)
    doc.rect(20, doc.y, W - 40, 1).fill(LIGHT_GRAY)
    doc.moveDown(0.5)

    const grid = [
      { l: 'Produit', v: data.culture.toUpperCase() },
      { l: 'Qualité', v: `Grade ${data.qualityGrade}` },
      { l: 'Poids', v: formatKg(data.quantityKg) },
      { l: 'Prix Unitaire', v: formatXAF(data.pricePerKg) },
    ]

    grid.forEach((item) => {
      const y = doc.y
      doc.fontSize(8).fillColor(GRAY).text(item.l, 20, y)
      doc.fontSize(8).fillColor(BLACK).font('Helvetica-Bold').text(item.v, 140, y, { align: 'right', width: 120 })
      doc.moveDown(0.8)
    })

    doc.moveDown(0.5)
    doc.rect(20, doc.y, W - 40, 40).fill(LIGHT_GREEN)
    const totalY = doc.y - 40
    doc.fillColor(GREEN).fontSize(7).text('MONTANT BRUT', 30, totalY + 8)
    doc.fontSize(12).text(formatXAF(data.calculatedAmount), 30, totalY + 18, { width: W - 100 })

    doc.moveDown(2)
    if (data.advanceDeducted > 0) {
      doc.fillColor(GRAY).fontSize(7).text(`DÉDUCTION AVANCE : -${formatXAF(data.advanceDeducted)}`, 20)
      doc.moveDown(0.5)
    }
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text(`NET À PERCEVOIR : ${formatXAF(data.netDue)}`, 20)

    // Footer
    doc.fontSize(6).fillColor(GRAY).text(`Fait le ${formatDate(data.createdAt)}`, 20, 380, { align: 'center', width: W - 40 })
    doc.text('Document généré par AgriCollect CM', 20, 390, { align: 'center', width: W - 40 })

    doc.end()
  })
}
