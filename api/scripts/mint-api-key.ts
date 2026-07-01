/**
 * Mint an API key for headless/agent access (e.g. the MCP server) without going
 * through the admin HTTP endpoint. The raw key is printed once — copy it now.
 *
 * Usage:
 *   pnpm mint-key --email you@example.com --name "MCP server"
 *   pnpm mint-key --user-id <cuid> --name "MCP server"
 *
 * Mirrors ApiKeysService.create() (api/src/api-keys/api-keys.service.ts). Keep
 * the key format in sync with that file.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

const API_KEY_PREFIX = 'ork_';
const PREFIX_LEN = API_KEY_PREFIX.length + 8;
const BCRYPT_ROUNDS = 12;

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('--email');
  const userIdArg = arg('--user-id');
  const name = arg('--name') || 'API key';

  if (!email && !userIdArg) {
    throw new Error('Provide --email <email> or --user-id <cuid>.');
  }

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findUnique({ where: { id: userIdArg! } });

  if (!user) {
    throw new Error(`No user found for ${email ?? userIdArg}.`);
  }

  const raw = `${API_KEY_PREFIX}${randomBytes(30).toString('base64url')}`;
  const prefix = raw.slice(0, PREFIX_LEN);
  const hashedKey = await bcrypt.hash(raw, BCRYPT_ROUNDS);

  const record = await prisma.apiKey.create({
    data: { name, prefix, hashedKey, userId: user.id },
  });

  console.log(`\nCreated API key "${name}" for ${user.email} (${user.role}).`);
  console.log(`  id:     ${record.id}`);
  console.log(`  prefix: ${prefix}`);
  console.log('\n  Raw key (shown once — copy it into ORTHO_API_KEY):\n');
  console.log(`    ${raw}\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
