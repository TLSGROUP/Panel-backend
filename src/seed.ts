import { PrismaClient } from "../prisma/generated/client"
import { faker } from "@faker-js/faker"
import { hash } from "argon2"
import 'dotenv/config'
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

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

async function main() {
    const NUM_USERS = 200
    for (let i = 0; i < NUM_USERS; i++) {
        const email = faker.internet.email()
        const name = faker.person.firstName()
        const avatarPath = faker.image.avatar()
        const password = await hash('123456')
        const country = faker.helpers.arrayElement(countries)
        const createdAt = faker.date.past({ years: 1 })

        const updatedAt = new Date(
            createdAt.getTime() + 
            Math.random() * (Date.now() - createdAt.getTime())
        )

        await prisma.user.create({
            data: {
                email,
                name,
                avatarPath,
                password,
                country: country.code,
                createdAt,
                updatedAt,
            },
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
