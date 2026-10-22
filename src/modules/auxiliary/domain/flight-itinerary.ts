import { validTransferImages } from '../domain/transfer-images';
import { type TransferImage } from '../domain/transfer-images';

export type FlightItinerary = {
  reservationCode: string;
  passengers: string;
  images?: TransferImage[];
  confirmed: boolean;
};
export const newFlightItinerary = (): FlightItinerary => ({
  reservationCode: '',
  passengers: '',
  confirmed: false,
});
export function validFlightItinerary(value: unknown): value is FlightItinerary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as FlightItinerary;
  return (
    Object.keys(v).every((k) =>
      ['reservationCode', 'passengers', 'images', 'confirmed'].includes(k),
    ) &&
    typeof v.reservationCode === 'string' &&
    !!v.reservationCode.trim() &&
    v.reservationCode.length <= 120 &&
    typeof v.passengers === 'string' &&
    !!v.passengers.trim() &&
    v.passengers.length <= 6000 &&
    v.confirmed === true &&
    (v.images === undefined || validTransferImages(v.images))
  );
}
export function normalizeFlightItinerary(v: FlightItinerary): FlightItinerary {
  return {
    ...v,
    reservationCode: v.reservationCode.trim(),
    passengers: v.passengers.trim(),
  };
}
export type FlightItineraryRow = {
  id: string;
  reservation_code: string;
  encrypted_data: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_operation: string;
};
export type SavedFlightItinerary = {
  id: string;
  data: FlightItinerary;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
