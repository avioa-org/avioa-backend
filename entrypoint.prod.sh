set -e

echo "🗄️ Running migrations..."
npx prisma migrate deploy

echo "🚀 Starting app..."
node dist/src/main.js