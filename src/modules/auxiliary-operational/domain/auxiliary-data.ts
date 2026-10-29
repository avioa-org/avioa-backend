import type { PassportInfo } from './passport-validity';
export type AuxDocumentKind = 'passport' | 'idcard';
export const auxFields = {
  names: 'Nombres',
  surnames: 'Apellidos',
  documentNumber: 'Número de documento',
  birthDate: 'Fecha de nacimiento',
} as const;
export type AuxFields = { [K in keyof typeof auxFields]: string };
export const emptyAuxFields: AuxFields = {
  names: '',
  surnames: '',
  documentNumber: '',
  birthDate: '',
};
export type AuxAttachment = {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  hash: string;
};
export type AuxPassenger = {
  fields: AuxFields;
  warnings: string[];
  passport?: PassportInfo;
  sources: number[];
  groupingReason?: string;
};
export type AuxDocument = {
  id: string;
  kind: AuxDocumentKind;
  reservationCode: string;
  fields: AuxFields;
  warnings: string[];
  passport?: PassportInfo;
  passengers?: AuxPassenger[];
  attachments: { fileName: string; contentType: string; size: number }[];
  state: 'uploaded' | 'extracted' | 'verified';
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
export type AuxDocumentRow = {
  id: string;
  kind: AuxDocumentKind;
  reservation_code: string;
  encrypted_data: string;
  attachments: string;
  state: AuxDocument['state'];
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
