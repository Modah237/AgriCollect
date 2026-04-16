import { PrismaClient, PlanTier, UserRole, CampaignStatus, QualityGrade } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Démarrage des simulations AgriCollect...')

  const passwordHash = await bcrypt.hash('Simulate2026!', 10)
  const pinHash = await bcrypt.hash('1234', 10)

  // ─── SCÉNARIO 1 : GIC NEER (VIDE) ──────────────────────────────────────────
  console.log('📦 GIC 1 : Création de SimGIC-NEER (Vide)...')
  const gic1 = await prisma.gic.create({
    data: {
      name: 'SimGIC-NEER (Nouveau)',
      region: 'Centre',
      cultureTypes: ['Cacao'],
      users: {
        create: {
          fullName: 'Manager Neer',
          email: 'manager.neer@simulate.com',
          passwordHash,
          role: 'MANAGER',
        }
      }
    }
  })

  // ─── SCÉNARIO 2 : GIC ZERO (REMBOURSEMENT TOTAL) ───────────────────────────
  console.log('📦 GIC 2 : Création de SimGIC-ZERO (Solde 0)...')
  const gic2 = await prisma.gic.create({
    data: {
      name: 'SimGIC-ZERO (Equilibre)',
      region: 'Est',
      cultureTypes: ['Café'],
      users: {
        create: [
          { fullName: 'Manager Zero', email: 'manager.zero@simulate.com', passwordHash, role: 'MANAGER' },
          { fullName: 'Collecteur Zero', role: 'COLLECTOR', pinHash, deviceId: 'SIM-DEV-002' }
        ]
      }
    }
  })

  const camp2 = await prisma.campaign.create({
    data: {
      gicId: gic2.id,
      name: 'Campagne Test Zero',
      status: 'ACTIVE',
      startDate: new Date(),
      priceRules: { create: { culture: 'Café', qualityGrade: 'A', pricePerKg: 500 } }
    }
  })

  const prod2 = await prisma.producer.create({
    data: { gicId: gic2.id, fullName: 'Planteur Jean (Dette)', phoneMomo: '237670000002', momoOperator: 'MTN' }
  })

  // Une avance de 10 000 XAF
  const adv2 = await prisma.advance.create({
    data: { producerId: prod2.id, campaignId: camp2.id, amount: 10000, repaidAmount: 10000 }
  })

  const coll2 = await prisma.user.findFirst({ where: { gicId: gic2.id, role: 'COLLECTOR' } })

  // Une livraison de 20kg à 500 = 10 000 XAF. Net dû = 0
  await prisma.delivery.create({
    data: {
      campaignId: camp2.id,
      producerId: prod2.id,
      collectorId: coll2!.id,
      culture: 'Café',
      quantityKg: 20,
      qualityGrade: 'A',
      pricePerKg: 500,
      calculatedAmount: 10000,
      advanceDeducted: 10000,
      netDue: 0,
      offlineUuid: 'sim-uuid-zero-001',
      deviceId: 'SIM-DEV-002',
      createdOfflineAt: new Date(),
      syncedAt: new Date()
    }
  })

  // ─── SCÉNARIO 3 : GIC RELIQUAT (REMBOURSEMENT PARTIEL) ─────────────────────
  console.log('📦 GIC 3 : Création de SimGIC-RELIQUAT...')
  const gic3 = await prisma.gic.create({
    data: {
      name: 'SimGIC-RELIQUAT',
      region: 'Sud',
      cultureTypes: ['Cacao'],
      users: {
        create: [
          { fullName: 'Manager Reliq', email: 'manager.reliq@simulate.com', passwordHash, role: 'MANAGER' },
          { fullName: 'Collecteur Reliq', role: 'COLLECTOR', pinHash, deviceId: 'SIM-DEV-003' }
        ]
      }
    }
  })

  const camp3 = await prisma.campaign.create({
    data: {
      gicId: gic3.id,
      name: 'Campagne Test Reliq',
      status: 'ACTIVE',
      startDate: new Date(),
      priceRules: { create: { culture: 'Cacao', qualityGrade: 'A', pricePerKg: 1000 } }
    }
  })

  const prod3 = await prisma.producer.create({
    data: { gicId: gic3.id, fullName: 'Planteur Paul (Reste)', phoneMomo: '237670000003' }
  })

  // Avance 5000
  await prisma.advance.create({ data: { producerId: prod3.id, campaignId: camp3.id, amount: 5000, repaidAmount: 5000 } })

  const coll3 = await prisma.user.findFirst({ where: { gicId: gic3.id, role: 'COLLECTOR' } })

  // Livraison 15kg à 1000 = 15 000. Dédution 5000. Reste 10 000.
  await prisma.delivery.create({
    data: {
      campaignId: camp3.id,
      producerId: prod3.id,
      collectorId: coll3!.id,
      culture: 'Cacao',
      quantityKg: 15,
      qualityGrade: 'A',
      pricePerKg: 1000,
      calculatedAmount: 15000,
      advanceDeducted: 5000,
      netDue: 10000,
      offlineUuid: 'sim-uuid-reliq-001',
      deviceId: 'SIM-DEV-003',
      createdOfflineAt: new Date(),
      syncedAt: new Date()
    }
  })

  // ─── SCÉNARIO 4 : GIC GRADES ──────────────────────────────────────────────
  console.log('📦 GIC 4 : Création de SimGIC-GRADES...')
  const gic4 = await prisma.gic.create({
    data: {
      name: 'SimGIC-GRADES',
      region: 'Nord',
      cultureTypes: ['Cacao'],
      users: {
        create: { fullName: 'Manager Grades', email: 'manager.grades@simulate.com', passwordHash, role: 'MANAGER' }
      }
    }
  })

  const camp4 = await prisma.campaign.create({
    data: {
      gicId: gic4.id,
      name: 'Campagne Grades',
      status: 'ACTIVE',
      startDate: new Date(),
      priceRules: {
        create: [
          { culture: 'Cacao', qualityGrade: 'A', pricePerKg: 1200 },
          { culture: 'Cacao', qualityGrade: 'B', pricePerKg: 900 }
        ]
      }
    }
  })

  // ─── SCÉNARIO 5 : STRESS TEST ──────────────────────────────────────────────
  console.log('📦 GIC 5 : Création de SimGIC-STRESS (100 livraisons)...')
  const gic5 = await prisma.gic.create({
    data: {
      name: 'SimGIC-STRESS (High Volume)',
      region: 'Ouest',
      cultureTypes: ['Cacao'],
      users: {
        create: [
          { fullName: 'Manager Stress', email: 'manager.stress@simulate.com', passwordHash, role: 'MANAGER' },
          { fullName: 'Collecteur Fast', role: 'COLLECTOR', pinHash, deviceId: 'SIM-DEV-005' }
        ]
      }
    }
  })

  const camp5 = await prisma.campaign.create({
    data: {
      gicId: gic5.id,
      name: 'Campagne Stress',
      status: 'ACTIVE',
      startDate: new Date(),
      priceRules: { create: { culture: 'Cacao', qualityGrade: 'A', pricePerKg: 1000 } }
    }
  })

  const prod5 = await prisma.producer.create({ data: { gicId: gic5.id, fullName: 'Planteur Stressé', phoneMomo: '237670000005' } })
  const coll5 = await prisma.user.findFirst({ where: { gicId: gic5.id, role: 'COLLECTOR' } })

  const entries = []
  for (let i = 0; i < 100; i++) {
    entries.push({
      campaignId: camp5.id,
      producerId: prod5.id,
      collectorId: coll5!.id,
      culture: 'Cacao',
      quantityKg: 10,
      qualityGrade: 'A' as QualityGrade,
      pricePerKg: 1000,
      calculatedAmount: 10000,
      netDue: 10000,
      offlineUuid: `stress-uuid-${i}`,
      deviceId: 'SIM-DEV-005',
      createdOfflineAt: new Date(),
      syncedAt: new Date()
    })
  }

  await prisma.delivery.createMany({ data: entries })

  console.log('✅ Toutes les simulations ont été injectées !')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
