#!/bin/sh

echo "Waiting for database ..."

while ! nc -z db 5432; do
    sleep 0.1
done

echo "Database started"

echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la

echo "Looking for Prisma schema..."
ls -la prisma/ || echo "prisma/ folder not found!"

npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "Migrate failed"

npx prisma generate --schema=./prisma/schema.prisma || echo "Generate failed"

echo "Prisma commands finished. Starting app..."

exec "$@"