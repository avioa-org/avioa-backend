set -e

echo "🗄️ Running migrations..."
npx prisma migrate deploy --config dist/prisma.config.js

echo "🚀 Starting app..."
node dist/src/main.js