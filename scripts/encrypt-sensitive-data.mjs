import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const prisma = new PrismaClient();

function parseKey(value) {
  if (!value) throw new Error('DATA_ENCRYPTION_KEY is required');
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64 or 64 hex characters');
  }
  return key;
}

const key = parseKey(process.env.DATA_ENCRYPTION_KEY);

function encrypt(value) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
}

async function inBatches(items, update, size = 100) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(update));
  }
}

async function main() {
  const [employees, accounts, checkins, metrics] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [
          { bankName: { not: null } },
          { accountNumber: { not: null } },
          { taxNumber: { not: null } },
        ],
      },
      select: { id: true, bankName: true, accountNumber: true, taxNumber: true },
    }),
    prisma.bankAccount.findMany({
      select: { id: true, bankName: true, accountNumber: true },
    }),
    prisma.healthCheckin.findMany({
      select: { id: true, symptoms: true, medicineNotes: true, notes: true },
    }),
    prisma.healthMetric.findMany({
      where: { notes: { not: null } },
      select: { id: true, notes: true },
    }),
  ]);

  await inBatches(employees, (row) =>
    prisma.employee.update({
      where: { id: row.id },
      data: {
        bankName: encrypt(row.bankName),
        accountNumber: encrypt(row.accountNumber),
        taxNumber: encrypt(row.taxNumber),
      },
    }),
  );
  await inBatches(accounts, (row) =>
    prisma.bankAccount.update({
      where: { id: row.id },
      data: {
        bankName: encrypt(row.bankName),
        accountNumber: encrypt(row.accountNumber),
      },
    }),
  );
  await inBatches(checkins, (row) =>
    prisma.healthCheckin.update({
      where: { id: row.id },
      data: {
        symptoms: row.symptoms.map(encrypt),
        medicineNotes: encrypt(row.medicineNotes),
        notes: encrypt(row.notes),
      },
    }),
  );
  await inBatches(metrics, (row) =>
    prisma.healthMetric.update({
      where: { id: row.id },
      data: { notes: encrypt(row.notes) },
    }),
  );

  console.log(
    `Encrypted sensitive fields for ${employees.length} employees, ${accounts.length} bank accounts, ${checkins.length} check-ins, and ${metrics.length} health metrics.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
