/**
 * One-time password reset script.
 * Runs on deploy if any of the RESET_*_PASSWORD env vars is set.
 * After successful rotation, remove the RESET_* env vars from Railway.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const SALT_ROUNDS = 10;

type StaffDefault = {
  username: string;
  envVar: string;
  role: 'owner' | 'manager' | 'admin' | 'staff' | 'groomer';
  firstName: string;
  lastName: string;
};

const resets: StaffDefault[] = [
  { username: 'admin',   envVar: 'RESET_ADMIN_PASSWORD',   role: 'owner',   firstName: 'Sarah', lastName: 'Manager' },
  { username: 'staff1',  envVar: 'RESET_STAFF_PASSWORD',   role: 'staff',   firstName: 'Mike',  lastName: 'Receptionist' },
  { username: 'groomer1',envVar: 'RESET_GROOMER_PASSWORD', role: 'groomer', firstName: 'Emma',  lastName: 'Groomer' },
  { username: 'becky',   envVar: 'RESET_BECKY_PASSWORD',   role: 'owner',   firstName: 'Becky', lastName: 'HTHD' },
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
    for (const { username, envVar, role, firstName, lastName } of toReset) {
      const newPassword = process.env[envVar]!;
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      const user = await prisma.staffUser.findUnique({ where: { username } });
      if (!user) {
        console.log(`Password reset: User '${username}' not found — creating...`);
        await prisma.staffUser.create({
          data: { username, passwordHash, role, firstName, lastName, isActive: true },
        });
        console.log(`Password reset: Created '${username}' (role=${role}).`);
      } else {
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
