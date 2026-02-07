#!/bin/sh
echo "Syncing database schema..."
npx prisma db push --skip-generate
echo "Starting server..."
npm start
