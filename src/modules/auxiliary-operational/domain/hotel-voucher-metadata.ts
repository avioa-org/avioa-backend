import { cataloniaMetadata } from './catalonia-voucher-metadata';
import { santaMartaNaioMetadata } from './santa-marta-naio-voucher-metadata';
import { solDubaiMetadata } from './sol-dubai-voucher-metadata';
import { cartagenaPlazaMetadata } from './cartagena-plaza-voucher-metadata';
const originalHotelVoucherMetadata: Record<
  string,
  {
    hotelName: string;
    destination: string;
    hotelAddress: string;
    mealPlan: string;
    notes: string;
    checkInTime?: string;
    checkOutTime?: string;
  }
> = {
  verdemar: {
    hotelName: 'Hotel Verde Mar',
    destination: 'Isla de San Andrés',
    hotelAddress: 'Av. 20 de Julio No. 2A-13, San Andrés',
    mealPlan: 'Todo Incluido',
    notes:
      'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
  },
  dorado: {
    hotelName: 'Hotel Dorado Plaza Bocagrande',
    destination: 'Bocagrande · Cartagena',
    hotelAddress: 'Av. San Martín #4-41, Bocagrande, Cartagena',
    mealPlan: 'Todo Incluido',
    notes:
      'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
  },
  sirenissanandres: {
    hotelName: 'Grand Sirenis San Andrés',
    destination: 'Isla de San Andrés',
    hotelAddress:
      'Avenida Newball Carrera 1, frente al Muelle Toninos Marina, San Andrés',
    mealPlan: 'Todo Incluido',
    notes:
      'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
  },
  sirenis: {
    hotelName: 'Grand Sirenis Cartagena',
    destination: 'Manzanillo del Mar · Cartagena',
    hotelAddress: 'Anillo vial Manzanillo del Mar kilómetro 3 - 750, Cartagena',
    mealPlan: 'Todo Incluido',
    notes:
      'Presentar documentos de identificación originales. No incluye seguro hotelero.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
  },
  sunrise: {
    hotelName: 'GHL Sunrise',
    destination: 'Isla de San Andrés',
    hotelAddress: '',
    mealPlan: '',
    notes: 'Presentar documentos de identificación originales.',
  },
};

export const hotelVoucherMetadata: typeof originalHotelVoucherMetadata = {
  ...originalHotelVoucherMetadata,
  ...cataloniaMetadata,
  ...santaMartaNaioMetadata,
  ...solDubaiMetadata,
  cartagenaplaza: cartagenaPlazaMetadata,
  ...{
    tamaca: {
      hotelName: 'Tamacá Beach Resort',
      destination: 'Santa Marta',
      hotelAddress: 'Carrera 2 # 11A - 98, El Rodadero, Santa Marta',
      mealPlan: 'Con desayuno',
      notes:
        'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
    },
    blutamaca: {
      hotelName: 'Blu by Tamacá',
      destination: 'Santa Marta',
      hotelAddress: 'Carrera 2 #11-65, El Rodadero, Santa Marta',
      mealPlan: 'Con desayuno',
      notes:
        'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
    },
    sunrise: {
      hotelName: 'GHL Sunrise',
      destination: 'Isla de San Andrés',
      hotelAddress: 'Av. Newball # 4-169, San Andrés',
      mealPlan: 'PAE',
      notes:
        'Presentar documentos de identificación originales. La acomodación y el plan de alimentación corresponden a los servicios reservados.',
    },
  },
};
