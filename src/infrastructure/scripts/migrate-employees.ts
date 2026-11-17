import 'dotenv/config';
import * as XLSX from 'xlsx';
import { hash } from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from '../../config/env.config';

const connectionString = envs.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

const EXCEL_PATH = path.join(__dirname, './data/Base_datos_empleados.xlsx');
const REPORT_CREATED_PATH = path.join(__dirname, './data/reporte-creados.csv');
const REPORT_SKIPPED_PATH = path.join(__dirname, './data/reporte-omitidos.csv');

// const EXCEL_PATH = process.argv[2];
// const REPORT_CREATED_PATH = process.argv[3] ?? '/tmp/reporte-creados.csv';
// const REPORT_SKIPPED_PATH = process.argv[4] ?? '/tmp/reporte-omitidos.csv';

if (!EXCEL_PATH) {
  console.error('❌ Debes proporcionar la ruta del archivo Excel.');
  process.exit(1);
}

interface ExcelRow {
  'N°'?: number;
  'NOMBRES Y APELLIDOS'?: string;
  CC?: number | string;
  CARGO?: string;
  'CEL CORPORATIVO'?: string | number;
  'RAZÓN SOCIAL'?: string;
  'FECHA DE VINCULACION'?: number;
  DIRECCIÓN?: string;
  ARL?: string;
  PENSIONES?: string;
  EPS?: string;
  'FECHA DE NACIMIENTO'?: Date | string;
  'NOMBRE DE CONTACO/ TELEFONO'?: string;
  AREA?: string;
  CONTRATO?: string;
}

interface CreatedRecord {
  documentNumber: string;
  name: string;
  tempPassword: string;
}

interface SkippedRecord {
  documentNumber: string;
  name: string;
  reason: string;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';

  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function parseEmergencyContact(raw?: string): {
  name?: string;
  phone?: string;
} {
  if (!raw || typeof raw !== 'string') return {};

  const phoneMatch = raw.match(/(\d[\d\s]{6,})$/);
  const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : undefined;
  const name = phone
    ? raw
        .slice(0, raw.indexOf(phoneMatch![1]))
        .replace(/[-/]\s*$/, '')
        .trim()
    : raw.trim();

  return { name: name || undefined, phone };
}

function toDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }

  // Fechas seriales de Excel / Google Sheets
  if (typeof value === 'number') {
    // Excel usa 1899-12-30 como origen para fechas seriales
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);

    return isNaN(date.getTime()) ? undefined : date;
  }

  // Por si viene como string numérico: "45832"
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    const serial = Number(value);

    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + serial * 24 * 60 * 60 * 1000);

    return isNaN(date.getTime()) ? undefined : date;
  }

  const parsed = new Date(value as string);

  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function getDocumentType(documentNumber: string): {
  documentNumber: number;
  documentType: string;
} {
  if (documentNumber.includes('TI')) {
    const number = documentNumber.split('TI ')[1];
    return { documentNumber: parseInt(number), documentType: 'TI' };
  }

  return { documentNumber: parseInt(documentNumber), documentType: 'CC' };
}

async function main() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 1 });

  const created: CreatedRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const row of rows) {
    const name = row['NOMBRES Y APELLIDOS']?.toString().trim();
    const documentNumber = row.CC?.toString().trim();

    if (!name || !documentNumber || documentNumber.length < 5) continue;

    const { documentNumber: documentNumberInt, documentType } =
      getDocumentType(documentNumber);

    const existing = await prisma.user.findUnique({
      where: { documentNumber },
    });

    if (existing) {
      skipped.push({
        documentNumber,
        name,
        reason: 'Ya existe un usuario con ese numero de documento',
      });
      continue;
    }

    const { name: emergencyContactName, phone: emergencyContactPhone } =
      parseEmergencyContact(row['NOMBRE DE CONTACO/ TELEFONO']);

    const tempPassword = generateTempPassword();
    const hashedPassword = await hash(tempPassword, 10);

    try {
      await prisma.user.create({
        data: {
          name,
          documentNumber: documentNumberInt.toString(),
          documentType: documentType === 'TI' ? 'TI' : 'CC',
          password: hashedPassword,
          mustChangePassword: true,
          status: 'ACTIVE',
          position: row.CARGO?.toString().trim() || undefined,
          phone:
            row['CEL CORPORATIVO']?.toString().trim().replace(/\s/g, '') ||
            undefined,
          legalEntity: row['RAZÓN SOCIAL']?.toString().trim() || undefined,
          address: row.DIRECCIÓN?.toString().trim() || undefined,
          area: row.AREA?.toString().trim() || undefined,
          startDate:
            toDate(row['FECHA DE VINCULACION']) || toDate(row['CONTRATO']),
          birthDate: toDate(row['FECHA DE NACIMIENTO']),
          arl: row.ARL?.toString().trim() || undefined,
          afp: row.PENSIONES?.toString().trim() || undefined,
          eps: row.EPS?.toString().trim() || undefined,
          emergencyContactName,
          emergencyContactPhone,
        },
      });
      created.push({ documentNumber, name, tempPassword });
    } catch (error) {
      console.error(`Fila ${documentNumber}:`, error);
      skipped.push({
        documentNumber,
        name,
        reason: 'Error al crear el usuario',
      });
    }
  }

  const createdCsv = [
    'documentNumber,name,tempPassword',
    ...created.map((r) => `${r.documentNumber},"${r.name}",${r.tempPassword}`),
  ].join('\n');
  fs.writeFileSync(REPORT_CREATED_PATH, createdCsv, 'utf-8');

  const skippedCsv = [
    'documentNumber,name,reason',
    ...skipped.map((r) => `${r.documentNumber},"${r.name}","${r.reason}"`),
  ].join('\n');
  fs.writeFileSync(REPORT_SKIPPED_PATH, skippedCsv, 'utf-8');

  console.log(`✅ Creados: ${created.length}`);
  console.log(`⚠️  Omitidos: ${skipped.length}`);
  console.log(
    `Reportes escritos en /data/reporte-creados.csv y /data/reporte-omitidos.csv`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
