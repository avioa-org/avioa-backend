// import 'dotenv/config';
// import * as XLSX from 'xlsx';

// import { PrismaClient } from '../../../generated/prisma/client';
// import { PrismaPg } from '@prisma/adapter-pg';
// import { envs } from '../../config/env.config';
// import * as path from 'path';

// const connectionString = envs.DATABASE_URL;

// if (!connectionString) {
//   throw new Error('DATABASE_URL no esta definida');
// }

// const adapter = new PrismaPg({ connectionString });
// const prisma = new PrismaClient({ adapter });

// const PATH = path.join(
//   __dirname,
//   './data/BASE_DE_DATOS_POR_RAZON_SOCIAL_Y_CORREOS_CORPORATIVOS.xlsx',
// );

// if (!PATH) {
//   console.error('❌ Debes proporcionar la ruta del archivo Excel.');
//   process.exit(1);
// }

// async function main() {
//   const workbook = XLSX.readFile(PATH);
//   const sheet = workbook.Sheets[workbook.SheetNames[0]];
//   const rawRows = XLSX.utils.sheet_to_json(sheet);

//   const rows = rawRows.map((row) => {
//     return Object.fromEntries(
//       Object.entries(row).map(([key, value]) => [key.trim(), value]),
//     );
//   });

//   const todosLosCorreos = rows
//     .map((row) => {
//       const correo = row['CORREO'] as string;
//       if (!correo) return null;
//       return correo.includes('/') ? correo.split('/')[0].trim() : correo.trim();
//     })
//     .filter(Boolean) as string[];

//   const usuariosExistentes = await prisma.user.findMany({
//     where: { email: { in: todosLosCorreos } },
//     select: { email: true },
//   });

//   const correosEnBD = new Set(usuariosExistentes.map((u) => u.email));

//   const transactions = [];
//   const correosProcesadosEnExcel = new Set<string>();

//   for (const row of rows) {
//     const name = row['NOMBRES Y APELLIDOS'];
//     const celularCorporativo = row['CELULAR CORPORATIVO'];
//     const razonSocial = row['RAZÓN SOCIAL'];
//     let correo: string = row['CORREO'] as string;

//     if (!correo || !name) continue;

//     if (correo.includes('/')) {
//       correo = correo.split('/')[0].trim();
//     } else {
//       correo = correo.trim();
//     }

//     if (correosProcesadosEnExcel.has(correo)) {
//       console.log(
//         `El correo ${correo} se repite en la base de datos, se omitirá...`,
//       );
//       continue;
//     }

//     correosProcesadosEnExcel.add(correo);

//     if (correosEnBD.has(correo)) {
//       console.log(
//         `El correo [${correo}] ya existe asignado a otro usuario en la BD, se omitirá...`,
//       );
//       continue;
//     }

//     const user = await prisma.user.findFirst({
//       where: { name },
//       select: { userId: true },
//     });

//     if (user) {
//       const updatePromise = prisma.user.update({
//         where: { userId: user.userId },
//         data: {
//           email: correo,
//           phone: String(celularCorporativo),
//         },
//       });

//       // transactions.push(updatePromise);
//     }
//   }

//   console.log(
//     `Ejecutando ${transactions.length} actualizaciones en una transacción...`,
//   );

//   await prisma.$transaction(transactions);

//   console.log('¡Actualización masiva completada con éxito!');
// }

// main()
//   .catch((e) => console.error(e))
//   .finally(() => prisma.$disconnect());
