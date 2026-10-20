import { ForbiddenException } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { Role } from 'generated/prisma/enums';

export function createEmployeeTools(prisma: PrismaService) {
  const searchEmployee = tool(
    async ({ query }) => {
      const employees = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          isUserTest: false,
          name: { contains: query.trim(), mode: 'insensitive' },
        },
        select: {
          name: true,
          position: true,
          department: true,
          area: true,
          office: true,
          role: true,
        },
        orderBy: { name: 'asc' },
        take: 8,
      });
      return employees;
    },
    {
      name: 'search_employee',
      description: 'Busca colaboradores activos por nombre y devuelve solo datos básicos del directorio.',
      schema: z.object({ query: z.string().trim().min(2).max(100) }),
    },
  );

  const getEmployeeContact = tool(
    async ({ employeeName, department, position }) => {
      const employees = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          isUserTest: false,
          name: { equals: employeeName.trim(), mode: 'insensitive' },
          ...(department ? { department: { equals: department, mode: 'insensitive' as const } } : {}),
          ...(position ? { position: { equals: position, mode: 'insensitive' as const } } : {}),
        },
        select: {
          name: true,
          email: true,
          phone: true,
          position: true,
          department: true,
          area: true,
          office: true,
        },
        take: 2,
      });

      if (!employees.length) return { found: false };
      if (employees.length > 1) {
        return {
          found: false,
          ambiguous: true,
          matches: employees.map(({ name, position: job, department: team, office }) => ({
            name,
            position: job,
            department: team,
            office,
          })),
        };
      }

      const employee = employees[0];
      return {
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        position: employee.position,
        department: employee.department,
        area: employee.area,
        office: employee.office,
      };
    },
    {
      name: 'get_employee_contact',
      description: 'Devuelve correo y teléfono laboral de un colaborador. No consulta dirección ni contactos de emergencia.',
      schema: z.object({
        employeeName: z.string().trim().min(2).max(120),
        department: z.string().trim().min(1).max(100).optional(),
        position: z.string().trim().min(1).max(100).optional(),
      }),
    },
  );

  return [searchEmployee, getEmployeeContact];
}

export function createKnowledgeSearchTool(
  prisma: PrismaService,
  userId: string,
  role: Role,
) {
  return tool(
    async ({ query }) => {
      const canSearch =
        role === Role.ADMIN ||
        (await prisma.modulePermission.findFirst({
          where: {
            userId,
            module: 'KNOWLEDGE',
            canAccess: true,
          },
          select: { modulePermissionId: true },
        }));
      if (!canSearch) {
        throw new ForbiddenException('No tienes permiso para consultar el conocimiento corporativo.');
      }

      const [folders, files] = await Promise.all([
        prisma.knowledgeFolder.findMany({
          where: { name: { contains: query.trim(), mode: 'insensitive' } },
          select: { name: true },
          orderBy: { name: 'asc' },
          take: 10,
        }),
        prisma.knowledgeFile.findMany({
          where: { title: { contains: query.trim(), mode: 'insensitive' } },
          select: {
            title: true,
            driveUrl: true,
            folder: { select: { name: true } },
          },
          orderBy: { title: 'asc' },
          take: 10,
        }),
      ]);
      return { folders, files };
    },
    {
      name: 'search_company_knowledge',
      description: 'Busca títulos de archivos y carpetas de conocimiento que tienes autorizados; devuelve enlaces, no lee el contenido del documento.',
      schema: z.object({ query: z.string().trim().min(3).max(120) }),
    },
  );
}
