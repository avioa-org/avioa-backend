import { Injectable } from '@nestjs/common';
import { FiltrosNomina, NominaService } from './nomina.service';
import * as ExcelJS from 'exceljs';
import {
  NovedadConsolidada,
  ResumenColaborador,
  TotalesNomina,
} from './types/novedad.type';

const COLORES = {
  headerBg: 'FF1E3A5F',
  headerFont: 'FFFFFFFF',
  sumaBg: 'FFD1FAE5',
  sumaFont: 'FF065F46',
  restaBg: 'FFFEE2E2',
  restaFont: 'FF991B1B',
  cruceBg: 'FFFEF3C7',
  bandaBg: 'FFF8FAFC',
};

@Injectable()
export class NominaExportService {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(private readonly nominaService: NominaService) {
    this.formatter = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async generarWorkbook(
    filtros: FiltrosNomina,
    generadoPor: string,
  ): Promise<ExcelJS.Workbook> {
    const [novedades, resumen, totales] = await Promise.all([
      this.nominaService.consolidar(filtros),
      this.nominaService.resumenPorColaborador(filtros),
      this.nominaService.totalesPeriodo(filtros),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Portal - Módulo de Nómina';
    workbook.lastModifiedBy = generadoPor;
    workbook.created = new Date();
    workbook.properties.date1904 = false;

    this.construirHojaResumen(workbook, filtros, totales, generadoPor);
    this.construirHojaDetalle(workbook, novedades);
    this.construirHojaPorColaborador(workbook, resumen);

    return workbook;
  }

  private construirHojaResumen(
    workbook: ExcelJS.Workbook,
    filtros: FiltrosNomina,
    totales: TotalesNomina,
    generadoPor: string,
  ) {
    const sheet = workbook.addWorksheet('Resumen', {
      properties: { tabColor: { argb: 'FF1E3A5F' } },
    });

    sheet.columns = [{ width: 32 }, { width: 20 }];

    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = 'Reporte de novedades de nómina';
    sheet.getCell('A1').font = {
      size: 16,
      bold: true,
      color: { argb: COLORES.headerFont },
    };
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORES.headerBg },
    };
    sheet.getRow(1).height = 28;

    const meta: [string, string][] = [
      ['Periodo', `${filtros.desde}  →  ${filtros.hasta}`],
      ['Generado por', generadoPor],
      ['Fecha de generación', new Date().toLocaleString('es-CO')],
      ['Filtros de colaborador', filtros.userId ?? 'Todos'],
      [
        'Filtros de tipo',
        filtros.tipos?.length ? filtros.tipos.join(', ') : 'Todos',
      ],
    ];

    let fila = 3;

    for (const [label, valor] of meta) {
      sheet.getCell(`A${fila}`).value = label;
      sheet.getCell(`A${fila}`).font = { bold: true };
      sheet.getCell(`B${fila}`).value = valor;
      fila++;
    }

    fila += 1;
    sheet.getCell(`A${fila}`).value = 'Totales del periodo';
    sheet.getCell(`A${fila}`).font = { bold: true, size: 12 };
    fila++;

    const filaEncabezado = fila;
    sheet.getCell(`A${filaEncabezado}`).value = 'Indicador';
    sheet.getCell(`B${filaEncabezado}`).value = 'Valor';
    sheet.getRow(filaEncabezado).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: COLORES.headerFont } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORES.headerBg },
      };
    });
    fila++;

    const indicadores: [string, number][] = [
      ['Colaboradores afectados', totales.colaboradoresAfectados],
      ['Total de novedades', totales.totalNovedades],
      ['Días de vacaciones', totales.totalDiasVacaciones],
      ['Días de ausencia', totales.totalDiasAusencia],
      ['Horas extra', totales.totalHorasExtra],
      ['Días no remunerados', totales.totalDiasNoRemunerados],
      ['Novedades que cruzan periodo', totales.novedadesQueCruzanPeriodo],
      ['Incapacidades sin soporte', totales.sinSoporte],
      ['Horas de ausencia parcial', totales.totalHorasParciales],
    ];

    for (const [label, valor] of indicadores) {
      sheet.getCell(`A${fila}`).value = label;
      sheet.getCell(`B${fila}`).value = valor;
      sheet.getCell(`B${fila}`).alignment = { horizontal: 'right' };
      if (label === 'Incapacidades sin soporte' && valor > 0) {
        sheet.getCell(`B${fila}`).font = {
          bold: true,
          color: { argb: COLORES.restaFont },
        };
        fila++;
      }
    }
  }

  private construirHojaDetalle(
    workbook: ExcelJS.Workbook,
    novedades: NovedadConsolidada[],
  ) {
    const sheet = workbook.addWorksheet('Detalle de novedades');

    sheet.columns = [
      { header: 'Colaborador', key: 'nombreColaborador', width: 32 },
      { header: 'Documento', key: 'documentNumber', width: 14 },
      { header: 'Cargo', key: 'position', width: 20 },
      { header: 'Área', key: 'area', width: 16 },
      { header: 'Sede', key: 'office', width: 14 },
      { header: 'Razón social', key: 'legalEntity', width: 24 },
      { header: 'Tipo de novedad', key: 'tipoLabel', width: 28 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      {
        header: 'Inicio real',
        key: 'fechaInicio',
        width: 13,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      {
        header: 'Fin real',
        key: 'fechaFin',
        width: 13,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      {
        header: 'Inicio en periodo',
        key: 'fechaInicioEnPeriodo',
        width: 16,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      {
        header: 'Fin en periodo',
        key: 'fechaFinEnPeriodo',
        width: 16,
        style: { numFmt: 'dd/mm/yyyy' },
      },
      { header: 'Cantidad en periodo', key: 'cantidadEnPeriodo', width: 16 },
      { header: 'Cantidad total', key: 'cantidadTotal', width: 14 },
      { header: '¿Cruza periodo?', key: 'cruza', width: 14 },
      { header: 'Remunerada', key: 'esRemuneradaTexto', width: 12 },
      { header: 'Compensada', key: 'esCompensadaTexto', width: 12 },
      { header: 'Efecto en nómina', key: 'afectaNomina', width: 14 },
      { header: 'Motivo', key: 'motivo', width: 36 },
      { header: 'Soporte', key: 'attachmentUrl', width: 30 },
      { header: 'Aprobado por', key: 'nombreAprobador', width: 26 },
      {
        header: 'Fecha de aprobación',
        key: 'fechaAprobacion',
        width: 16,
        style: { numFmt: 'dd/mm/yyyy hh:mm' },
      },
      { header: 'Hora inicio', key: 'horaInicio', width: 12 },
      { header: 'Hora fin', key: 'horaFin', width: 12 },
      { header: 'Total horas', key: 'totalHorasTexto', width: 12 },
      {
        header: 'Solicitada el',
        key: 'fechaRegistro',
        width: 18,
        style: { numFmt: 'dd/mm/yyyy hh:mm' },
      },
    ];

    this.aplicarEstiloEncabezado(sheet);

    novedades.forEach((n, i) => {
      const fila = sheet.addRow({
        ...n,
        fechaInicio: new Date(n.fechaInicio),
        fechaFin: new Date(n.fechaFin),
        fechaInicioEnPeriodo: new Date(n.fechaInicioEnPeriodo),
        fechaFinEnPeriodo: new Date(n.fechaFinEnPeriodo),
        cruza: n.cruzaPeriodoAnterior || n.cruzaPeriodoSiguiente ? 'Sí' : 'No',
        esRemuneradaTexto: n.esRemunerada ? 'Sí' : 'No',
        fechaAprobacion: n.fechaAprobacion ? new Date(n.fechaAprobacion) : null,
        horaInicio: n.horaInicio ?? '—',
        horaFin: n.horaFin ?? '—',
        fechaRegistro: this.formatter.format(new Date(n.createdAt)),
        esCompensadaTexto: n.esCompensada ? 'Sí' : 'No',
        totalHorasTexto:
          n.esParcial && n.totalHoras ? `${n.totalHoras} h` : '-',
      });

      if (i % 2 === 1) {
        fila.eachCell((cell) => {
          if (!cell.fill || (cell.fill as any).fgColor?.argb === undefined) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLORES.bandaBg },
            };
          }
        });
      }

      const celdaCantidad = fila.getCell('cantidadEnPeriodo');
      celdaCantidad.numFmt = n.unidad === 'HORAS' ? '0.00" h"' : '0" d"';
      celdaCantidad.alignment = { horizontal: 'right' };
      celdaCantidad.font = { bold: true };

      const celdaEfecto = fila.getCell('afectaNomina');
      celdaEfecto.value = n.afectaNomina === 'SUMA' ? '+ Suma' : '- Resta';
      celdaEfecto.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: n.afectaNomina === 'SUMA' ? COLORES.sumaBg : COLORES.restaBg,
        },
      };
      celdaEfecto.font = {
        bold: true,
        color: {
          argb:
            n.afectaNomina === 'SUMA' ? COLORES.sumaFont : COLORES.restaFont,
        },
      };

      const celdaComp = fila.getCell('esCompensadaTexto');
      if (n.esCompensada) {
        celdaComp.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0F2FE' },
        };
        celdaComp.font = { bold: true, color: { argb: 'FF2563EB' } };
      }

      if (n.cruzaPeriodoAnterior || n.cruzaPeriodoSiguiente) {
        fila.getCell('cruza').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORES.cruceBg },
        };
      }

      if (n.attachmentUrl) {
        const celdaSoporte = fila.getCell('attachmentUrl');
        celdaSoporte.value = {
          text: 'Ver soporte',
          hyperlink: n.attachmentUrl,
        };
        celdaSoporte.font = { color: { argb: 'FF2563EB' }, underline: true };
      }
    });

    if (novedades.length > 0) {
      const ultimaCol = sheet.getColumn(sheet.columnCount).letter;
      sheet.autoFilter = {
        from: 'A1',
        to: `${ultimaCol}${novedades.length + 1}`,
      };
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // if (novedades.length > 0) {
    //   const filaTotal = sheet.addRow({ nombreColaborador: 'TOTAL' });
    //   filaTotal.getCell('nombreColaborador').font = { bold: true };
    //   const colCantidad = sheet.getColumn('cantidadEnPeriodo').letter;
    //   filaTotal.getCell('cantidadEnPeriodo').value = {
    //     formula: `SUM(${colCantidad}2:${colCantidad}${novedades.length + 1})`,
    //   };
    //   filaTotal.getCell('cantidadEnPeriodo').font = { bold: true };
    //   filaTotal.eachCell((cell) => {
    //     cell.border = { top: { style: 'double' } };
    //   });
    // }

    if (novedades.length > 0) {
      const primeraFilaDatos = 2;
      const ultimaFilaDatos = novedades.length + 1;

      const colCantidad = sheet.getColumn('cantidadEnPeriodo').letter;
      const colUnidad = sheet.getColumn('unidad').letter;

      const filaTotalDias = sheet.addRow({ nombreColaborador: 'TOTAL DÍAS' });
      filaTotalDias.getCell('nombreColaborador').font = { bold: true };
      filaTotalDias.getCell('cantidadEnPeriodo').value = {
        formula: `SUMIF(${colUnidad}${primeraFilaDatos}:${colUnidad}${ultimaFilaDatos},"DIAS",${colCantidad}${primeraFilaDatos}:${colCantidad}${ultimaFilaDatos})`,
      };
      filaTotalDias.getCell('cantidadEnPeriodo').numFmt = '0" d"';
      filaTotalDias.getCell('cantidadEnPeriodo').font = { bold: true };
      filaTotalDias.eachCell((cell) => {
        cell.border = { top: { style: 'thin' } };
      });

      const filaTotalHoras = sheet.addRow({ nombreColaborador: 'TOTAL HORAS' });
      filaTotalHoras.getCell('nombreColaborador').font = { bold: true };
      filaTotalHoras.getCell('cantidadEnPeriodo').value = {
        formula: `SUMIF(${colUnidad}${primeraFilaDatos}:${colUnidad}${ultimaFilaDatos},"HORAS",${colCantidad}${primeraFilaDatos}:${colCantidad}${ultimaFilaDatos})`,
      };
      filaTotalHoras.getCell('cantidadEnPeriodo').numFmt = '0.00" h"';
      filaTotalHoras.getCell('cantidadEnPeriodo').font = { bold: true };
      filaTotalHoras.eachCell((cell) => {
        cell.border = { bottom: { style: 'double' } };
      });
    }
  }

  private construirHojaPorColaborador(
    workbook: ExcelJS.Workbook,
    resumen: ResumenColaborador[],
  ) {
    const sheet = workbook.addWorksheet('Por colaborador');

    sheet.columns = [
      { header: 'Colaborador', key: 'nombreColaborador', width: 32 },
      { header: 'Documento', key: 'documentNumber', width: 14 },
      { header: 'Cargo', key: 'position', width: 20 },
      { header: 'Área', key: 'area', width: 16 },
      { header: 'Razón social', key: 'legalEntity', width: 24 },
      { header: 'Días vacaciones', key: 'totalDiasVacaciones', width: 15 },
      { header: 'Días ausencia', key: 'totalDiasAusencia', width: 14 },
      { header: 'Horas extra', key: 'totalHorasExtra', width: 12 },
      { header: 'Días no remunerados', key: 'diasNoRemunerados', width: 16 },
      { header: '# Novedades', key: 'numNovedades', width: 12 },
    ];

    this.aplicarEstiloEncabezado(sheet);

    resumen.forEach((r, i) => {
      const fila = sheet.addRow({ ...r, numNovedades: r.novedades.length });
      if (i % 2 == 1) {
        fila.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORES.bandaBg },
          };
        });
      }

      if (r.diasNoRemunerados > 0) {
        fila.getCell('diasNoRemunerados').font = {
          bold: true,
          color: { argb: COLORES.restaFont },
        };
      }
    });

    if (resumen.length > 0) {
      sheet.autoFilter = { from: 'A1', to: `J${resumen.length + 1}` };
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private aplicarEstiloEncabezado(sheet: ExcelJS.Worksheet) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: COLORES.headerFont } };
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORES.headerBg },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    header.height = 22;
  }
}
