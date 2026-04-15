import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Début du seeding...')

  // 1. Créer le GIC
  // On utilise un ID fixe pour faciliter le développement du mobile
  const gicId = 'clxp1v2a0000008mi0g5h8xyz'
  
  const gic = await prisma.gic.upsert({
    where: { id: gicId },
    update: {
      name: 'GIC Socoprom Test',
      isActive: true,
    },
    create: {
      id: gicId,
      name: 'GIC Socoprom Test',
      region: 'Centre',
      cultureTypes: ['cacao', 'cafe'],
      isActive: true,
    },
  })

  console.log(`GIC créé/mis à jour: ${gic.name} (${gic.id})`)

  // 2. Créer le Manager (pour le Dashboard Web)
  const managerEmail = 'admin@agricollect.cm'
  const managerPassword = await bcrypt.hash('admin1234', 10)
  
  await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      passwordHash: managerPassword,
    },
    create: {
      email: managerEmail,
      fullName: 'Admin Socoprom',
      passwordHash: managerPassword,
      role: 'MANAGER',
      gicId: gic.id,
      isActive: true,
    },
  })

  console.log(`Manager créé: ${managerEmail}`)

  // 3. Créer le Collecteur (pour l'App Mobile)
  const collectorId = 'clxp2v2a0000008mi0g5h8abc'
  const pinHash = await bcrypt.hash('1234', 10)
  
  await prisma.user.upsert({
    where: { id: collectorId },
    update: {
      pinHash,
      deviceId: 'device-test-01',
    },
    create: {
      id: collectorId,
      fullName: 'Jean Collecteur',
      pinHash: pinHash,
      deviceId: 'device-test-01',
      role: 'COLLECTOR',
      gicId: gic.id,
      isActive: true,
    },
  })

  console.log(`Collecteur créé: Jean Collecteur (PIN: 1234, DeviceID: device-test-01)`)

  // 4. Créer une campagne active (idempotent — skip si elle existe déjà)
  let campaign = await prisma.campaign.findFirst({
    where: { gicId: gic.id, name: 'Petite Saison 2026' },
  })

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        gicId: gic.id,
        name: 'Petite Saison 2026',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        priceRules: {
          createMany: {
            data: [
              { culture: 'cacao', qualityGrade: 'A', pricePerKg: 1500 },
              { culture: 'cacao', qualityGrade: 'B', pricePerKg: 1200 },
              { culture: 'cafe', qualityGrade: 'A', pricePerKg: 900 },
            ],
          },
        },
      },
    })
    console.log(`Campagne active créée: ${campaign.name}`)
  } else {
    console.log(`Campagne déjà existante: ${campaign.name} (skip)`)
  }

  // 5. Créer des producteurs de test
  await prisma.producer.createMany({
    data: [
      { gicId: gic.id, fullName: 'Samuel Etoo', phoneMomo: '670000001', momoOperator: 'MTN', isActive: true },
      { gicId: gic.id, fullName: 'Roger Milla', phoneMomo: '690000002', momoOperator: 'ORANGE', isActive: true },
      { gicId: gic.id, fullName: 'Vincent Aboubakar', phoneMomo: '670000003', momoOperator: 'MTN', isActive: true },
    ],
    skipDuplicates: true,
  })

  console.log('Producteurs de test créés.')
  console.log('\nSeed terminé avec succès !')
  console.log('-----------------------------------')
  console.log('IMPORTANT: Utilisez ces IDs dans le mobile/.env :')
  console.log(`EXPO_PUBLIC_GIC_ID=${gic.id}`)
  console.log('-----------------------------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
