// scripts/seed-users.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  // Usa EXACTAMENTE el mismo método que el AuthService (hash con salt 10)
  const password = '12345678Ab';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Eliminar usuarios existentes
  await prisma.user.deleteMany();

  // Crear usuario ADMIN
  await prisma.user.create({
    data: {
      userId: 'afe17ddc-b632-4062-82d5-42bfe91f8219',
      name: 'SEBASTIAN MONSALVE CASTAÑEDA',
      documentNumber: '1001652083',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      area: 'TECNOLOGÍA',
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('✅ Usuario ADMIN creado con password: 12345678Ab');
  console.log('Hash generado con salt 10:', hashedPassword);

  await app.close();
}

bootstrap();