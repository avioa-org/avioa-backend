import type { TransferVoucher } from './aux-transfer';
import {
  transferProfiles,
  type TransferTemplate,
} from './aux-transfer-profiles';

// A template's sample excursions are not proof that a request includes those tours.
export function transferVoucherSections(
  v: TransferVoucher,
  template: TransferTemplate,
) {
  const profile = transferProfiles[template];
  if (
    template !== 'naio' &&
    template !== 'decameronbaru' &&
    !v.sourceRequestId &&
    v.tours === true
  )
    return profile.sections;
  const sections = [
    {
      title: transferVoucherServiceTitle({ ...v, tours: false }),
      text:
        'Aeropuerto – ' +
        v.dropoff +
        (v.service === 'roundtrip' ? ' – Aeropuerto.' : '.') +
        ' La disponibilidad y las horas de recogida deben confirmarse con el operador. Las horas indicadas corresponden a los vuelos.',
    },
  ];
  if (template === 'portofino')
    sections.push(transferProfiles.portofino.sections[0]);
  if (template === 'naio' || template === 'decameronbaru')
    sections.push(...profile.sections);
  if (v.tours) {
    sections.push({ title: 'Tours solicitados', text: v.tourNotes || '' });
    if (template === 'portofino')
      sections.push(transferProfiles.portofino.sections[1]);
    if (template === 'taximarino') sections.push(...profile.sections);
  } else
    sections.push({ title: 'Tours', text: 'No incluidos en esta solicitud.' });
  return sections;
}

export function transferVoucherServiceTitle(v: TransferVoucher) {
  return v.tours === true
    ? 'Combo de tours + Traslado'
    : v.service === 'roundtrip'
      ? 'Traslados de ida y regreso'
      : 'Traslado de ida';
}
