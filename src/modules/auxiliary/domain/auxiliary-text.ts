import type { AuxFields, AuxDocument, AuxPassenger } from "./auxiliary-data";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function passengerEmailLine(fields: AuxFields) {
  const date = clean(fields.birthDate),
    birth = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date.slice(8, 10) + "/" + date.slice(5, 7) + "/" + date.slice(0, 4)
      : date;
  return [
    [clean(fields.names), clean(fields.surnames)].filter(Boolean).join(" "),
    fields.documentNumber.trim()
      ? "Documento: " + clean(fields.documentNumber)
      : "",
    birth ? "Nacimiento: " + birth : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function passengersEmailText(fields: AuxFields[]) {
  return fields.map(passengerEmailLine).filter(Boolean).join("\n");
}
export function identityUploadGroups<T>(
  files: T[],
  mode: "passengers" | "sides",
): T[][] {
  if (!files.length || files.length > (mode === "sides" ? 2 : 10))
    throw Error(
      mode === "sides"
        ? "Selecciona hasta dos caras del mismo documento."
        : "Selecciona hasta 10 archivos, uno por pasajero.",
    );
  return mode === "sides" ? [files] : files.map((file) => [file]);
}
export async function processIdentityBatch<T, R>(
  groups: T[][],
  process: (group: T[], index: number) => Promise<R>,
  onResult: (result: R) => void,
  onProgress: (index: number) => void,
) {
  const failures: { index: number; message: string }[] = [];
  let completed = 0;
  for (let index = 0; index < groups.length; index++) {
    onProgress(index);
    try {
      const result = await process(groups[index], index);
      onResult(result);
      completed++;
    } catch (error) {
      failures.push({ index, message: (error as Error).message });
    }
  }
  return { completed, failures };
}

export function documentPassengers(document: AuxDocument): AuxPassenger[] {
  return document.passengers?.length
    ? document.passengers
    : [
        {
          fields: document.fields,
          warnings: document.warnings,
          passport: document.passport,
          sources: document.attachments.map((_, i) => i + 1),
        },
      ];
}
