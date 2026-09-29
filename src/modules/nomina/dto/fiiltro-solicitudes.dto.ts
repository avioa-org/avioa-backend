import { LeaveType } from 'generated/prisma/enums';

const TIPOS_VALIDOS = [...Object.values(LeaveType), 'OVERTIME'];
const ESTADOS_VALIDOS = [
  'PENDING_HR_VALIDATION',
  'PENDDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

function toArray({ value }: { value: unknown }) {
  if (typeof value === 'string') return value.split(',').map((v) => v.trim());
  return value;
}
