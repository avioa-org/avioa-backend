// forms.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  CreateFormDto,
  UpdateFormDto,
  SubmitFormDto,
  UpdateSubmissionStatusDto,
  FormType,
} from './dto/create-form.dto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validar que el schema de un formulario nativo es válido
   */
  private validateFormSchema(schema: any): void {
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      throw new BadRequestException('El schema del formulario no es válido');
    }

    if (schema.fields.length === 0) {
      throw new BadRequestException(
        'El formulario debe tener al menos un campo',
      );
    }

    // Validar que no hay nombres de campos duplicados
    const fieldNames = schema.fields.map((f) => f.name);
    const uniqueNames = new Set(fieldNames);

    if (fieldNames.length !== uniqueNames.size) {
      throw new BadRequestException(
        'No pueden existir campos con nombres duplicados',
      );
    }

    // Validar cada campo
    schema.fields.forEach((field, index) => {
      if (!field.name || !field.label || !field.type) {
        throw new BadRequestException(
          `El campo en la posición ${index} debe tener name, label y type`,
        );
      }

      // Validar tipos permitidos
      const validTypes = [
        'text',
        'email',
        'number',
        'date',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'file',
      ];
      if (!validTypes.includes(field.type)) {
        throw new BadRequestException(
          `El tipo de campo "${field.type}" no es válido en la posición ${index}`,
        );
      }

      // Si es select o radio, debe tener opciones
      if (
        (field.type === 'select' || field.type === 'radio') &&
        !field.options
      ) {
        throw new BadRequestException(
          `El campo "${field.name}" debe tener opciones`,
        );
      }

      // Validar opciones si existen
      if (field.options && Array.isArray(field.options)) {
        field.options.forEach((option, optIdx) => {
          if (!option.label || !option.value) {
            throw new BadRequestException(
              `La opción ${optIdx} del campo "${field.name}" debe tener label y value`,
            );
          }
        });
      }

      // Validar validaciones si existen
      if (field.validation) {
        if (
          field.validation.min !== undefined &&
          field.validation.max !== undefined
        ) {
          if (field.validation.min > field.validation.max) {
            throw new BadRequestException(
              `En el campo "${field.name}", min no puede ser mayor que max`,
            );
          }
        }
      }
    });
  }

  /**
   * Validar que los datos enviados cumplen con el schema del formulario
   */
  private validateSubmissionData(schema: any, submissionData: any): void {
    if (!schema || !schema.fields) {
      throw new BadRequestException('El schema del formulario no es válido');
    }

    schema.fields.forEach((field) => {
      const value = submissionData[field.name];

      // Validar campos requeridos
      if (
        field.required &&
        (value === undefined || value === null || value === '')
      ) {
        throw new BadRequestException(`El campo "${field.label}" es requerido`);
      }

      // Si el campo no es requerido y no tiene valor, saltar validaciones
      if (
        !field.required &&
        (value === undefined || value === null || value === '')
      ) {
        return;
      }

      // Validar tipo de dato
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new BadRequestException(
              `El campo "${field.label}" debe ser un email válido`,
            );
          }
          break;

        case 'number':
          if (isNaN(value)) {
            throw new BadRequestException(
              `El campo "${field.label}" debe ser un número`,
            );
          }
          if (field.validation) {
            if (
              field.validation.min !== undefined &&
              value < field.validation.min
            ) {
              throw new BadRequestException(
                `El campo "${field.label}" debe ser mayor o igual a ${field.validation.min}`,
              );
            }
            if (
              field.validation.max !== undefined &&
              value > field.validation.max
            ) {
              throw new BadRequestException(
                `El campo "${field.label}" debe ser menor o igual a ${field.validation.max}`,
              );
            }
          }
          break;

        case 'date':
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) {
            throw new BadRequestException(
              `El campo "${field.label}" debe ser una fecha válida (YYYY-MM-DD)`,
            );
          }
          if (
            new Date(value) instanceof Date &&
            !isNaN(new Date(value).getTime())
          ) {
            // fecha válida
          } else {
            throw new BadRequestException(
              `El campo "${field.label}" contiene una fecha inválida`,
            );
          }
          break;

        case 'text':
        case 'textarea':
          if (typeof value !== 'string') {
            throw new BadRequestException(
              `El campo "${field.label}" debe ser texto`,
            );
          }
          if (
            field.validation &&
            field.validation.min &&
            value.length < field.validation.min
          ) {
            throw new BadRequestException(
              `El campo "${field.label}" debe tener al menos ${field.validation.min} caracteres`,
            );
          }
          if (
            field.validation &&
            field.validation.max &&
            value.length > field.validation.max
          ) {
            throw new BadRequestException(
              `El campo "${field.label}" no debe exceder ${field.validation.max} caracteres`,
            );
          }
          break;

        case 'select':
        case 'radio':
          const validOptions = field.options.map((o) => o.value);
          if (!validOptions.includes(value)) {
            throw new BadRequestException(
              `El valor "${value}" no es válido para el campo "${field.label}"`,
            );
          }
          break;

        case 'checkbox':
          if (typeof value !== 'boolean') {
            throw new BadRequestException(
              `El campo "${field.label}" debe ser booleano`,
            );
          }
          break;
      }
    });
  }

  /**
   * Validar que la categoría existe (opcional, puedes implementar una tabla de categorías)
   */
  private validateCategory(category: string): void {
    const validCategories = [
      'RRHH',
      'Tecnologia',
      'Finanzas',
      'Marketing',
      'Operaciones',
    ];
    if (!validCategories.includes(category)) {
      throw new BadRequestException(
        `La categoría "${category}" no es válida. Categorías válidas: ${validCategories.join(', ')}`,
      );
    }
  }

  /**
   * Crear un nuevo formulario con validaciones y transacción
   */
  async create(createFormDto: CreateFormDto): Promise<any> {
    try {
      // Validar categoría
      this.validateCategory(createFormDto.category);

      // Validar Google Form
      if (createFormDto.type === 'GOOGLE_FORM') {
        if (!createFormDto.embedUrl) {
          throw new BadRequestException(
            'El embedUrl es requerido para formularios de Google',
          );
        }
        // Validar que sea una URL válida
        try {
          new URL(createFormDto.embedUrl);
        } catch {
          throw new BadRequestException('El embedUrl no es una URL válida');
        }
      }

      // Validar formulario nativo
      if (createFormDto.type === 'NATIVE') {
        if (!createFormDto.schema) {
          throw new BadRequestException(
            'El schema es requerido para formularios nativos',
          );
        }
        this.validateFormSchema(createFormDto.schema);
      }

      // Usar transacción para crear el formulario
      const form = await this.prisma.$transaction(async (tx) => {
        return tx.form.create({
          data: {
            title: createFormDto.title,
            description: createFormDto.description,
            category: createFormDto.category,
            type: createFormDto?.type,
            embedUrl: createFormDto.embedUrl,
            schema: JSON.parse(JSON.stringify(createFormDto.schema)),
            autofill: createFormDto.autofill,
            status: 'DRAFT',
          },
        });
      });

      return form;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear el formulario');
    }
  }

  /**
   * Obtener todos los formularios con filtros
   */
  async findAll(filters?: {
    category?: string;
    status?: string;
    type?: string;
  }): Promise<any[]> {
    try {
      return await this.prisma.form.findMany({
        where: {
          ...(filters?.category && { category: filters.category }),
          ...(filters?.status && { status: filters.status }),
          ...(filters?.type && { type: filters.type }),
        },
        include: {
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener los formularios',
      );
    }
  }

  /**
   * Obtener un formulario específico
   */
  async findOne(formId: string): Promise<any> {
    try {
      // Validar que formId sea un UUID válido
      this.validateUUID(formId);

      const form = await this.prisma.form.findUnique({
        where: { formId },
        include: {
          _count: {
            select: { submissions: true },
          },
        },
      });

      if (!form) {
        throw new NotFoundException(
          `Formulario con ID ${formId} no encontrado`,
        );
      }

      return form;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el formulario');
    }
  }

  /**
   * Actualizar un formulario
   */
  async update(formId: string, updateFormDto: UpdateFormDto): Promise<any> {
    try {
      this.validateUUID(formId);

      const form = await this.prisma.form.findUnique({ where: { formId } });

      if (!form) {
        throw new NotFoundException(
          `Formulario con ID ${formId} no encontrado`,
        );
      }

      // No permitir cambiar estado de PUBLISHED a DRAFT
      if (form.status === 'PUBLISHED' && updateFormDto.status === 'DRAFT') {
        throw new BadRequestException(
          'No se puede cambiar un formulario publicado a borrador',
        );
      }

      // Validar schema si se está actualizando
      if (updateFormDto.schema) {
        this.validateFormSchema(updateFormDto.schema);
      }

      // Validar categoría si se está actualizando
      if (updateFormDto.category) {
        this.validateCategory(updateFormDto.category);
      }

      // Usar transacción para actualizar
      const updatedForm = await this.prisma.$transaction(async (tx) => {
        return tx.form.update({
          where: { formId },
          data: {
            ...(updateFormDto.title && { title: updateFormDto.title }),
            ...(updateFormDto.description && {
              description: updateFormDto.description,
            }),
            ...(updateFormDto.category && { category: updateFormDto.category }),
            ...(updateFormDto.status && { status: updateFormDto.status }),
            ...(updateFormDto.schema && {
              schema: JSON.parse(JSON.stringify(updateFormDto.schema)),
            }),
            ...(updateFormDto.autofill && { autofill: updateFormDto.autofill }),
          },
        });
      });

      return updatedForm;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar el formulario',
      );
    }
  }

  /**
   * Eliminar un formulario y todas sus submissions
   */
  async delete(formId: string): Promise<any> {
    try {
      this.validateUUID(formId);

      const form = await this.prisma.form.findUnique({ where: { formId } });

      if (!form) {
        throw new NotFoundException(
          `Formulario con ID ${formId} no encontrado`,
        );
      }

      // Usar transacción para eliminar el formulario y sus submissions
      const deletedForm = await this.prisma.$transaction(async (tx) => {
        // Primero eliminar todas las submissions
        await tx.formSubmission.deleteMany({
          where: { formId },
        });

        // Luego eliminar el formulario
        return tx.form.delete({
          where: { formId },
        });
      });

      return {
        message: 'Formulario eliminado exitosamente',
        deletedForm,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar el formulario');
    }
  }

  /**
   * Enviar respuesta de formulario
   */
  async submitForm(
    formId: string,
    userId: string,
    submitFormDto: SubmitFormDto,
  ): Promise<any> {
    try {
      this.validateUUID(formId);
      this.validateUUID(userId);

      const form = await this.prisma.form.findUnique({ where: { formId } });

      if (!form) {
        throw new NotFoundException(
          `Formulario con ID ${formId} no encontrado`,
        );
      }

      // Solo se puede enviar si el formulario está publicado
      if (form.status !== 'PUBLISHED') {
        throw new BadRequestException(
          'El formulario no está disponible para envíos',
        );
      }

      // Validar los datos del envío contra el schema
      if (form.type === 'NATIVE' && form.schema) {
        this.validateSubmissionData(form.schema, submitFormDto.data);
      }

      // Usar transacción para crear la submission
      const submission = await this.prisma.$transaction(async (tx) => {
        return tx.formSubmission.create({
          data: {
            formId,
            userId,
            data: submitFormDto.data,
            status: 'PENDING',
          },
        });
      });

      return {
        message: 'Formulario enviado exitosamente',
        submission,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error al enviar el formulario');
    }
  }

  /**
   * Obtener envíos de un formulario
   */
  async getSubmissions(
    formId: string,
    filters?: { status?: string; userId?: string },
  ): Promise<any[]> {
    try {
      this.validateUUID(formId);

      const form = await this.prisma.form.findUnique({ where: { formId } });

      if (!form) {
        throw new NotFoundException(
          `Formulario con ID ${formId} no encontrado`,
        );
      }

      return await this.prisma.formSubmission.findMany({
        where: {
          formId,
          ...(filters?.status && { status: filters.status }),
          ...(filters?.userId && { userId: filters.userId }),
        },
        include: {
          user: {
            select: {
              userId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los envíos');
    }
  }

  /**
   * Obtener un envío específico
   */
  async getSubmission(submissionId: string): Promise<any> {
    try {
      this.validateUUID(submissionId);

      const submission = await this.prisma.formSubmission.findUnique({
        where: { submissionId },
        include: {
          form: true,
          user: {
            select: {
              userId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!submission) {
        throw new NotFoundException(
          `Envío con ID ${submissionId} no encontrado`,
        );
      }

      return submission;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el envío');
    }
  }

  /**
   * Actualizar estado de un envío
   */
  async updateSubmissionStatus(
    submissionId: string,
    statusDto: UpdateSubmissionStatusDto,
  ): Promise<any> {
    try {
      this.validateUUID(submissionId);

      const submission = await this.prisma.formSubmission.findUnique({
        where: { submissionId },
      });

      if (!submission) {
        throw new NotFoundException(
          `Envío con ID ${submissionId} no encontrado`,
        );
      }

      // Usar transacción para actualizar
      const updatedSubmission = await this.prisma.$transaction(async (tx) => {
        return tx.formSubmission.update({
          where: { submissionId },
          data: {
            status: statusDto.status,
          },
        });
      });

      return {
        message: 'Estado del envío actualizado',
        submission: updatedSubmission,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar el estado');
    }
  }

  /**
   * Validar que una cadena es un UUID válido
   */
  private validateUUID(uuid: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new BadRequestException('El ID proporcionado no es un UUID válido');
    }
  }
}
