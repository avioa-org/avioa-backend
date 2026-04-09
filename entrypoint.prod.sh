set -e

echo "🗄️ Running migrations..."
npx prisma migrate deploy --config prisma.config.mjs

echo "🚀 Starting app..."
node dist/src/main.js