import { PrismaClient } from "../prisma/generated/client"
import { faker } from "@faker-js/faker"
import { hash } from "argon2"
import 'dotenv/config'
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { buildReferralLink } from "./constants"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

const countries = [
  { name: "United States", code: "US" },
  { name: "Canada", code: "CA" },
  { name: "United Kingdom", code: "UK" },
  { name: "Australia", code: "AU" },
  { name: "Germany", code: "DE" },
]

const buildIdPrefix = (source?: string | null) => {
  const fallback = "user"
  const normalized = source?.trim().replace(/\s+/g, "") ?? ""
  const base = normalized || fallback

  return base.slice(0, 2).padEnd(2, "x").toUpperCase()
}

async function main() {
    const NUM_USERS = 200
    const prefixCounters: Record<string, number> = {}
    const createdUserIds: string[] = []
    for (let i = 0; i < NUM_USERS; i++) {
        const email = faker.internet.email()
        const name = faker.person.firstName()
        const lastName = faker.person.lastName()
        const avatarPath = faker.image.avatar()
        const password = await hash('123456')
        const country = faker.helpers.arrayElement(countries)
        const city = faker.location.city()
        const phone = faker.helpers.replaceSymbols('+1-###-###-####')
        const createdAt = faker.date.past({ years: 1 })

        const updatedAt = new Date(
            createdAt.getTime() + 
            Math.random() * (Date.now() - createdAt.getTime())
        )

        const prefix = buildIdPrefix(name || email)
        const nextNumber = (prefixCounters[prefix] ?? 0) + 1
        prefixCounters[prefix] = nextNumber
        const referralCode = `${prefix}${nextNumber}`
        const referralLink = buildReferralLink(referralCode)

        const referrerId =
            createdUserIds.length > 0
                ? faker.helpers.arrayElement(createdUserIds)
                : null

        await prisma.user.create({
            data: {
                id: referralCode,
                referralCode,
                referralLink,
                email,
                name,
                lastName,
                phone,
                city,
                avatarPath,
                password,
                country: country.code,
                createdAt,
                updatedAt,
                ...(referrerId && {
                    referrer: {
                        connect: {
                            id: referrerId,
                        },
                    },
                }),
            },
        })

        createdUserIds.push(referralCode)

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
