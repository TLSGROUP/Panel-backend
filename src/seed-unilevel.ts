import { PrismaClient } from "../prisma/generated/client"
import { hash } from "argon2"
import 'dotenv/config'
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { buildReferralLink } from "./constants"
import { MlmEngineService } from "./mlm-engine/mlm-engine.service"
import { SettingsService } from "./settings/settings.service"
import type { PrismaService } from "./prisma.service"

// Use the same adapter config as the main app for consistency.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const prismaService = prisma as unknown as PrismaService
const settingsService = new SettingsService(prismaService)
const mlmEngineService = new MlmEngineService(prismaService, settingsService)

async function main() {
  // Canonical plan catalog used by the Unilevel seed.
  const plansCatalog = [
    { id: "bronze", name: "Bronze", amount: 10000, currency: "USD" },
    { id: "silver", name: "Silver", amount: 20000, currency: "USD" },
    { id: "gold", name: "Gold", amount: 30000, currency: "USD" },
    { id: "platinum", name: "Platinum", amount: 50000, currency: "USD" },
  ]
  // Unilevel payout % by receiver plan and depth line.
  const planLevels = {
    bronze: [5],
    silver: [5, 3],
    gold: [8, 5, 3],
    platinum: [10, 8, 5, 2],
  }

  // Simulate registrations via http://localhost:3000/register?ref=RU1.
  const seedUsers = [
    { id: "RU1", email: "ru1_silver@example.com", planId: "silver", referrerId: null },
    { id: "RU1-L1-A", email: "ru1_line1_a@example.com", planId: "bronze", referrerId: "RU1" },
    { id: "RU1-L1-B", email: "ru1_line1_b@example.com", planId: "gold", referrerId: "RU1" },
    { id: "RU1-L1-C", email: "ru1_line1_c@example.com", planId: "platinum", referrerId: "RU1" },
    { id: "RU1-L2-A1", email: "ru1_line2_a1@example.com", planId: "bronze", referrerId: "RU1-L1-A" },
    { id: "RU1-L2-B1", email: "ru1_line2_b1@example.com", planId: "silver", referrerId: "RU1-L1-B" },
    { id: "RU1-L2-C1", email: "ru1_line2_c1@example.com", planId: "bronze", referrerId: "RU1-L1-C" },
  ]

  const seedUserIds = seedUsers.map((user) => user.id)
  // Clean previous seed artifacts for these users.
  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: seedUserIds } },
    select: { id: true }
  })
  if (wallets.length > 0) {
    await prisma.walletTransaction.deleteMany({
      where: { walletId: { in: wallets.map((wallet) => wallet.id) } }
    })
    await prisma.wallet.deleteMany({
      where: { id: { in: wallets.map((wallet) => wallet.id) } }
    })
  }
  await prisma.mlmPayout.deleteMany({
    where: {
      OR: [
        { receiverId: { in: seedUserIds } },
        { sourceUserId: { in: seedUserIds } }
      ]
    }
  })
  await prisma.payment.deleteMany({
    where: { userId: { in: seedUserIds } }
  })

  // Ensure plans exist for the UI and payout configuration.
  await prisma.setting.upsert({
    where: { key: "plans.catalog" },
    update: { value: JSON.stringify(plansCatalog) },
    create: { key: "plans.catalog", value: JSON.stringify(plansCatalog) },
  })
  await prisma.setting.upsert({
    where: { key: "plans.currency" },
    update: { value: "USD" },
    create: { key: "plans.currency", value: "USD" },
  })

  // Persist Unilevel settings in the dedicated MLM table.
  await prisma.mlmEngineSetting.upsert({
    where: { moduleKey: "unilevel" },
    update: { settings: { planLevels } },
    create: { moduleKey: "unilevel", settings: { planLevels } },
  })

  const planMap = Object.fromEntries(
    plansCatalog.map((plan) => [plan.id, plan])
  )
  const now = new Date()
  const basePassword = await hash('123456')

  // Create users with explicit referrers rooted at RU1.
  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: "Unilevel",
        lastName: user.planId.toUpperCase(),
        password: basePassword,
        referralCode: user.id,
        referralLink: buildReferralLink(user.id),
        ...(user.referrerId
          ? { referrer: { connect: { id: user.referrerId } } }
          : {}),
        activePlanId: user.planId,
        activePlanName: planMap[user.planId].name,
        activePlanPrice: planMap[user.planId].amount,
        activePlanCurrency: planMap[user.planId].currency,
        activePlanPurchasedAt: now,
      },
      create: {
        id: user.id,
        email: user.email,
        name: "Unilevel",
        lastName: user.planId.toUpperCase(),
        password: basePassword,
        referralCode: user.id,
        referralLink: buildReferralLink(user.id),
        ...(user.referrerId
          ? { referrer: { connect: { id: user.referrerId } } }
          : {}),
        activePlanId: user.planId,
        activePlanName: planMap[user.planId].name,
        activePlanPrice: planMap[user.planId].amount,
        activePlanCurrency: planMap[user.planId].currency,
        activePlanPurchasedAt: now,
      }
    })
  }

  // Simulate purchases by second-line users to test RU1 level-2 payouts.
  const buyers = seedUsers.filter((user) => user.id.startsWith("RU1-L2-"))
  for (const buyer of buyers) {
    const payment = await prisma.payment.create({
      data: {
        userId: buyer.id,
        planId: buyer.planId,
        planName: planMap[buyer.planId].name,
        amount: planMap[buyer.planId].amount,
        currency: planMap[buyer.planId].currency,
        status: 'SUCCEEDED',
        provider: 'STRIPE'
      }
    })

    await mlmEngineService.createUnilevelPayouts({
      paymentId: payment.id,
      buyerId: buyer.id,
      amount: payment.amount,
      currency: payment.currency
    })
  }
}

main()
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
