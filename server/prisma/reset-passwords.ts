/**
 * One-time password reset script.
 * Runs on deploy if RESET_ADMIN_PASSWORD env var is set.
 * After successful rotation, remove the RESET_* env vars from Railway.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const SALT_ROUNDS = 10;

const resets = [
  { username: 'admin', envVar: 'RESET_ADMIN_PASSWORD' },
  { username: 'staff1', envVar: 'RESET_STAFF_PASSWORD' },
  { username: 'groomer1', envVar: 'RESET_GROOMER_PASSWORD' },
];

async function main() {
  const toReset = resets.filter((r) => process.env[r.envVar]);

  if (toReset.length === 0) {
    console.log('Password reset: No RESET_*_PASSWORD env vars set — skipping.');
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const { username, envVar } of toReset) {
      const newPassword = process.env[envVar]!;

      const user = await prisma.staffUser.findUnique({ where: { username } });
      if (!user) {
        console.log(`Password reset: User '${username}' not found — creating...`);
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await prisma.staffUser.create({
          data: {
            username,
            passwordHash,
            role: username === 'admin' ? 'owner' : username === 'groomer1' ? 'groomer' : 'staff',
            firstName: username === 'admin' ? 'Sarah' : username === 'staff1' ? 'Mike' : 'Emma',
            lastName: username === 'admin' ? 'Manager' : username === 'staff1' ? 'Receptionist' : 'Groomer',
            isActive: true,
          },
        });
        console.log(`Password reset: Created '${username}' with new password.`);
      } else {
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await prisma.staffUser.update({
          where: { username },
          data: { passwordHash },
        });
        console.log(`Password reset: Updated password for '${username}'.`);
      }
    }

    console.log('Password reset: Complete. Remove RESET_*_PASSWORD env vars from Railway now.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Password reset error:', e);
  // Don't exit(1) — server should still start even if reset fails
});
