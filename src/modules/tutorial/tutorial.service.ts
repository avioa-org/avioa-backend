import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class TutorialService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tutorial.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: {
    title: string;
    description?: string;
    driveUrl: string;
    category?: string;
  }) {
    return this.prisma.tutorial.create({
      data: {
        title: data.title,
        description: data.description,
        driveUrl: data.driveUrl,
        category: data.category,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.tutorial.delete({ where: { tutorialId: id } });
  }
}
