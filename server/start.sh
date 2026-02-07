#!/bin/sh
echo "Syncing database schema..."
npx prisma db push
echo "Starting server..."
npm start
