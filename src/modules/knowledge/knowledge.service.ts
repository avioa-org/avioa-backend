import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getContents(folderId?: string) {
    const folder = folderId
      ? await this.prisma.knowledgeFolder.findUniqueOrThrow({
          where: { knowledgeFolderId: folderId },
        })
      : null;

    const [subfolders, files] = await Promise.all([
      this.prisma.knowledgeFolder.findMany({
        where: { parentId: folderId ?? null },
        include: { _count: { select: { children: true, files: true } } },
        orderBy: { name: 'asc' },
      }),
      folderId
        ? this.prisma.knowledgeFile.findMany({
            where: { folderId },
            orderBy: { title: 'asc' },
          })
        : [],
    ]);

    const breadcrumb = folder ? await this.getBreadcrumb(folder) : [];

    return { folder, breadcrumb, subfolders, files };
  }

  async createFolder(userId: string, dto: { name: string; parentId?: string }) {
    return this.prisma.knowledgeFolder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        createdById: userId,
      },
    });
  }

  async deleteFolder(folderId: string) {
    return this.prisma.knowledgeFolder.delete({
      where: { knowledgeFolderId: folderId },
    });
  }

  async createFile(
    userId: string,
    dto: { title: string; driveUrl: string; folderId: string },
  ) {
    return this.prisma.knowledgeFile.create({
      data: {
        title: dto.title,
        driveUrl: dto.driveUrl,
        folderId: dto.folderId,
        createdById: userId,
      },
    });
  }

  async deleteFile(fileId: string) {
    return this.prisma.knowledgeFile.delete({
      where: { knowledgeFileId: fileId },
    });
  }

  private async getBreadcrumb(folder: {
    knowledgeFolderId: string;
    name: string;
    parentId: string | null;
  }) {
    const path = [
      { knowledgeFolderId: folder.knowledgeFolderId, name: folder.name },
    ];

    let currentParentId = folder.parentId;

    while (currentParentId) {
      const parent = await this.prisma.knowledgeFolder.findFirstOrThrow({
        where: { knowledgeFolderId: currentParentId },
        select: { knowledgeFolderId: true, name: true, parentId: true },
      });
      path.unshift({
        knowledgeFolderId: parent.knowledgeFolderId,
        name: parent.name,
      });
      currentParentId = parent.parentId;
    }

    return path;
  }
}
