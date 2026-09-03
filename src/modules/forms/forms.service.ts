// forms/forms.service.ts - VERSIÓN ORIGINAL FUNCIONAL
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { CreateFormDto, UpdateFormDto } from './dto/create-form.dto';
import { v4 as uuidv4 } from 'uuid';

type SubmitFormDto = {
  answers?: Record<string, any>;
  [key: string]: any;
};

type UpdateSubmissionStatusDto = {
  status?: string;
  [key: string]: any;
};

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}



  // forms/forms.service.ts
// forms/forms.service.ts
async delete(formId: string) {
  console.log(`🔍 Service.delete - Iniciando para: ${formId}`);
  
  try {
    // Verificar que existe
    const existingForm = await this.prisma.form.findUnique({
      where: { formId },
    });
    
    console.log(`📋 Formulario encontrado:`, existingForm ? 'SI' : 'NO');
    
    if (!existingForm) {
      throw new NotFoundException(`Formulario ${formId} no encontrado`);
    }

    // Eliminar el formulario directamente
    console.log(`🗑️ Eliminando formulario...`);
    const result = await this.prisma.form.delete({
      where: { formId },
    });
    
    console.log(`✅ Formulario eliminado:`, result);
    
    return { 
      success: true, 
      message: 'Formulario eliminado correctamente',
      data: {
        form_id: result.formId,
        title: result.title,
      }
    };
  } catch (error) {
    console.error(`❌ Error en delete:`, error);
    throw error;
  }
}

  async create(createFormDto: CreateFormDto) {
    try {
      const formId = uuidv4();
      
      // ✅ CONSTRUCCIÓN MANUAL - SIN SPREAD
      const data = {
        formId: formId,
        title: createFormDto.title,
        description: createFormDto.description ?? null,
        category: createFormDto.category,
        embedUrl: createFormDto.embed_url ?? null, // 🔑 CLAVE: embedUrl NO embed_url
        type: createFormDto.type ?? 'google',
        status: createFormDto.status ?? 'active',
        schema: createFormDto.schema ?? null,
        autofill: createFormDto.autofill ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('🔍 Datos a guardar:', JSON.stringify(data, null, 2));

      const result = await this.prisma.form.create({ data });

      return {
        form_id: result.formId,
        title: result.title,
        description: result.description,
        category: result.category,
        embed_url: result.embedUrl,
        type: result.type,
        status: result.status,
        schema: result.schema,
        autofill: result.autofill,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error:', error);
      throw new InternalServerErrorException('Error al crear el formulario');
    }
  }

  async findAll(query: { category?: string; status?: string; type?: string; page?: string; limit?: string } = {}) {
    try {
      const page = Number.parseInt(query.page ?? '1', 10) || 1;
      const limit = Number.parseInt(query.limit ?? '6', 10) || 6;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.category) where.category = query.category;
      if (query.status) where.status = query.status;
      if (query.type) where.type = query.type;

      const [data, total] = await Promise.all([
        this.prisma.form.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        this.prisma.form.count({ where }),
      ]);

      return {
        data: data.map(form => ({
          form_id: form.formId,
          title: form.title,
          description: form.description,
          category: form.category,
          embed_url: form.embedUrl,
          type: form.type,
          status: form.status,
          schema: form.schema,
          autofill: form.autofill,
          created_at: form.createdAt,
          updated_at: form.updatedAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('❌ Error:', error);
      throw new InternalServerErrorException('Error al obtener formularios');
    }
  }

  async findOne(formId: string) {
    try {
      const form = await this.prisma.form.findUnique({ where: { formId } });
      if (!form) throw new NotFoundException(`Formulario ${formId} no encontrado`);

      return {
        form_id: form.formId,
        title: form.title,
        description: form.description,
        category: form.category,
        embed_url: form.embedUrl,
        type: form.type,
        status: form.status,
        schema: form.schema,
        autofill: form.autofill,
        created_at: form.createdAt,
        updated_at: form.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  }

  async update(formId: string, updateFormDto: UpdateFormDto) {
    try {
      await this.findOne(formId);

      const data: any = { updatedAt: new Date() };
      if (updateFormDto.title !== undefined) data.title = updateFormDto.title;
      if (updateFormDto.description !== undefined) data.description = updateFormDto.description;
      if (updateFormDto.category !== undefined) data.category = updateFormDto.category;
      if (updateFormDto.embed_url !== undefined) data.embedUrl = updateFormDto.embed_url;
      if (updateFormDto.type !== undefined) data.type = updateFormDto.type;
      if (updateFormDto.status !== undefined) data.status = updateFormDto.status;
      if (updateFormDto.schema !== undefined) data.schema = updateFormDto.schema;
      if (updateFormDto.autofill !== undefined) data.autofill = updateFormDto.autofill;

      const result = await this.prisma.form.update({ where: { formId }, data });

      return {
        form_id: result.formId,
        title: result.title,
        description: result.description,
        category: result.category,
        embed_url: result.embedUrl,
        type: result.type,
        status: result.status,
        schema: result.schema,
        autofill: result.autofill,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  }

  // Estos métodos son para las submissions, si los necesitas
  async submitForm(formId: string, userId: string, submitFormDto: SubmitFormDto) {
    // Implementación...
  }

  async getSubmissions(formId: string, filters: any) {
    // Implementación...
  }

  async getSubmission(submissionId: string) {
    // Implementación...
  }

  async updateSubmissionStatus(submissionId: string, statusDto: UpdateSubmissionStatusDto) {
    // Implementación...
  }
}