#!/bin/sh
echo "Syncing database schema..."
npx prisma db push --url "$DATABASE_URL"
echo "Seeding v2 service data..."
npx ts-node prisma/seed-v2.ts
echo "Checking for password resets..."
npx ts-node prisma/reset-passwords.ts
echo "Starting server..."
npm start
