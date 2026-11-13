import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";

const spreadsheet = "1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU";

const metadata = z.object({
  sheets: z.array(
    z.object({
      properties: z.object({ sheetId: z.number().int(), title: z.string() }),
    }),
  ),
});

const values = z.object({
  values: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
    .optional()
    .default([]),
});

@Injectable()
export class GoogleSheetClient {
  private auth: GoogleAuth | null = null;

  configured(): boolean {
    return !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    );
  }

  /**
   * Lee una pestaña específica del Excel usando la cuenta de servicio.
   * @param sheetId El "gid" de la pestaña (ej: 985693555)
   * @param rangeStr El rango a leer (ej: "A1:Z999")
   */
  async readAuthenticated(sheetId: number, rangeStr: string): Promise<string[][]> {
    if (!this.configured())
      throw new ServiceUnavailableException(
        "Faltan las variables de Google Service Account.",
      );

    this.auth ??= new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replaceAll(
          "\\n",
          "\n",
        ),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    try {
      const client = await this.auth.getClient();
      
      // 1. Obtener metadatos para saber el nombre de la pestaña por su GID
      const info = await client.request<unknown>({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet}`,
        params: { fields: "sheets.properties" },
        timeout: 25000,
        retry: false,
      });

      const title = metadata
        .parse(info.data)
        .sheets.find((s) => s.properties.sheetId === sheetId)
        ?.properties.title;

      if (!title) throw new Error(`Pestaña con gid ${sheetId} no encontrada.`);

      const range = `'${title.replaceAll("'", "''")}'!${rangeStr}`;

      // 2. Leer los valores de esa pestaña
      const response = await client.request<unknown>({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet}/values/${encodeURIComponent(range)}`,
        params: {
          valueRenderOption: "FORMATTED_VALUE",
          majorDimension: "ROWS",
        },
        timeout: 25000,
        retry: false,
      });

      return values.parse(response.data).values.map((row) => row.map(String));
    } catch (error: any) {
      console.error(`Error al leer el Sheet (gid: ${sheetId}):`, error.message);
      throw new ServiceUnavailableException(
        "Falló la lectura autenticada de Sheets.",
      );
    }
  }
}