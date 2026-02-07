#!/bin/sh
echo "Syncing database schema..."
npx prisma db push --url "$DATABASE_URL"
echo "Starting server..."
npm start
