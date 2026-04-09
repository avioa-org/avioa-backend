export class MensajePTDto {
  messageId!: string;
  fecha!: string;
  epochMs!: number;
  de!: string;
  asunto!: string;
  cuerpo!: string;
}

export class EventoPTDto {
  threadId!: string;
  asunto!: string;
  cliente!: string;
  fechaInicio!: string;
  ultimoMensajeEpochMs!: number;
  totalMensajes!: number;
  cuerpoPrimerMensaje?: string;
  mensajesNuevos!: MensajePTDto[];
  todosLosMensajes!: MensajePTDto[];
}
