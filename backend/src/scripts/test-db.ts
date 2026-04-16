import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  console.log('🔍 Testing DB connection...')
  const count = await prisma.gic.count()
  console.log('✅ GIC count:', count)
}
main()
  .catch((e) => {
    console.error('❌ DB Test Failed:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
