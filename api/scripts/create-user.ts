/**
 * Provision a user account (public self-registration is disabled). Built for
 * creating the lab technician's LAB_TECH account, but works for any role.
 * The password is printed once — hand it to the person over a secure channel
 * and have them change it in Account Settings.
 *
 * Usage:
 *   pnpm create-user --email tech@example.com --name "Lab Tech" --role LAB_TECH
 *   pnpm create-user --email x@y.cl --role STAFF --password "chosen-password"
 *
 * Omitting --password generates a random one.
 */
import { PrismaClient, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('--email');
  const name = arg('--name');
  const roleArg = (arg('--role') || 'LAB_TECH').toUpperCase();
  const password = arg('--password') || randomBytes(9).toString('base64url');

  if (!email) {
    throw new Error('Provide --email <email>.');
  }
  if (!(roleArg in Role)) {
    throw new Error(
      `Invalid role "${roleArg}". Valid roles: ${Object.keys(Role).join(', ')}.`,
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`A user with email ${email} already exists (${existing.role}).`);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: roleArg as Role,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    },
  });

  console.log(`\nCreated ${user.role} user ${user.email} (id ${user.id}).`);
  console.log('\n  Password (shown once — share securely, then have them change it):\n');
  console.log(`    ${password}\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
