import type { CommunicationChannel } from '../../generated/prisma';
import type {
  GuestContext,
  HotelContext,
  PreviewResult,
  ReservationContext,
  RoomContext,
  TemplateContext,
} from './communications.types';

// Locale data for date/number formatting
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
  ar: 'ar-SA',
  ru: 'ru-RU',
  nl: 'nl-NL',
  th: 'th-TH',
  vi: 'vi-VN',
  id: 'id-ID',
};

/**
 * Get locale string from language code
 */
function getLocale(languageCode: string): string {
  return LOCALE_MAP[languageCode.toLowerCase()] ?? 'en-US';
}

/**
 * Format a date according to locale
 */
function formatDate(date: Date | string, languageCode: string): string {
  const locale = getLocale(languageCode);
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a time according to locale
 */
function formatTime(time: Date | string, languageCode: string): string {
  const locale = getLocale(languageCode);
  const timeObj = typeof time === 'string' ? new Date(`1970-01-01T${time}`) : time;

  return timeObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency amount according to locale and currency code
 */
function formatCurrency(
  amount: number | string,
  currencyCode: string,
  languageCode: string
): string {
  const locale = getLocale(languageCode);
  const numAmount = typeof amount === 'string' ? Number.parseFloat(amount) : amount;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(numAmount);
}

/**
 * Escape HTML entities for EMAIL channel (prevents XSS)
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}

/**
 * Build a flat key-value map from nested context
 */
function flattenContext(context: TemplateContext): Record<string, string> {
  const flat: Record<string, string> = {};

  // Guest context
  if (context.guest) {
    flat['guest.firstName'] = context.guest.firstName;
    flat['guest.lastName'] = context.guest.lastName;
    flat['guest.fullName'] = context.guest.fullName;
    flat['guest.email'] = context.guest.email ?? '';
    flat['guest.mobile'] = context.guest.mobile ?? '';
  }

  // Reservation context
  if (context.reservation) {
    flat['reservation.confirmationNumber'] = context.reservation.confirmationNumber;
    flat['reservation.checkInDate'] = context.reservation.checkInDate;
    flat['reservation.checkOutDate'] = context.reservation.checkOutDate;
    flat['reservation.nights'] = String(context.reservation.nights);
    flat['reservation.totalAmount'] = context.reservation.totalAmount;
    flat['reservation.currencyCode'] = context.reservation.currencyCode;
    flat['reservation.specialRequests'] = context.reservation.specialRequests ?? '';
  }

  // Room context
  if (context.room) {
    flat['room.number'] = context.room.number;
    flat['room.type'] = context.room.type;
  }

  // Hotel context
  if (context.hotel) {
    flat['hotel.name'] = context.hotel.name;
    flat['hotel.phone'] = context.hotel.phone;
    flat['hotel.email'] = context.hotel.email;
    flat['hotel.address'] = context.hotel.address;
    flat['hotel.checkInTime'] = context.hotel.checkInTime;
    flat['hotel.checkOutTime'] = context.hotel.checkOutTime;
  }

  return flat;
}

/**
 * Regex to match {{variable}} patterns
 * Supports: {{guest.firstName}}, {{reservation.checkInDate}}, etc.
 */
const VARIABLE_PATTERN = /\{\{([a-zA-Z][a-zA-Z0-9_.]*)\}\}/g;

/**
 * Render a template string by replacing {{variable}} tokens with context values.
 *
 * Rules:
 * - Unknown variables render as empty string (no error thrown)
 * - HTML entities are escaped for EMAIL channel
 * - Values are substituted as-is; no automatic date or currency formatting is applied
 *
 * @param template The template string with {{variable}} placeholders
 * @param context The context object with values
 * @param options Rendering options
 * @returns The rendered string
 */
export function render(
  template: string,
  context: TemplateContext,
  options: {
    channel?: CommunicationChannel;
    languageCode?: string;
    currencyCode?: string;
  } = {}
): string {
  const { channel = 'EMAIL' } = options;

  const flatContext = flattenContext(context);

  return template.replace(VARIABLE_PATTERN, (_match, variableName: string) => {
    let value = flatContext[variableName];

    // Unknown variables render as empty string
    if (value === undefined) {
      return '';
    }

    // Escape HTML for EMAIL channel
    if (channel === 'EMAIL' && typeof value === 'string') {
      value = escapeHtml(value);
    }

    return value;
  });
}

/**
 * Type for preview context input - more permissive than TemplateContext
 * to accommodate Zod-inferred types with nested optional properties
 */
type OptionalOverride<T extends object> = {
  [K in keyof T]?: T[K] | undefined;
};

type PreviewContextInput = {
  guest?: OptionalOverride<GuestContext> | undefined;
  reservation?: OptionalOverride<ReservationContext> | undefined;
  room?: OptionalOverride<RoomContext> | undefined;
  hotel?: OptionalOverride<HotelContext> | undefined;
};

/**
 * Preview a template with sample or provided context
 * Does NOT create a Communication record
 *
 * @param subjectTemplate The subject template (or null for non-email)
 * @param bodyTemplate The body template
 * @param context Optional context to use (sample data used if not provided)
 * @param options Rendering options
 * @returns The rendered subject and body
 */
export function preview(
  subjectTemplate: string | null,
  bodyTemplate: string,
  context?: PreviewContextInput,
  options: {
    channel?: CommunicationChannel;
    languageCode?: string;
  } = {}
): PreviewResult {
  const { channel = 'EMAIL', languageCode = 'en' } = options;

  // Build sample context with any provided overrides
  const sampleContext = buildSampleContext(context);

  const renderedSubject = subjectTemplate
    ? render(subjectTemplate, sampleContext, { channel, languageCode })
    : null;

  const renderedBody = render(bodyTemplate, sampleContext, { channel, languageCode });

  return {
    subject: renderedSubject,
    body: renderedBody,
  };
}

/**
 * Build a sample context for template preview
 */
export function buildSampleContext(overrides?: PreviewContextInput): TemplateContext {
  const guestOverrides = overrides?.guest;
  const reservationOverrides = overrides?.reservation;
  const roomOverrides = overrides?.room;
  const hotelOverrides = overrides?.hotel;

  const sampleGuest: GuestContext = {
    firstName: guestOverrides?.firstName ?? 'John',
    lastName: guestOverrides?.lastName ?? 'Doe',
    fullName: guestOverrides?.fullName ?? 'John Doe',
    email: guestOverrides?.email ?? 'john.doe@example.com',
    mobile: guestOverrides?.mobile ?? '+1 555-123-4567',
    languageCode: guestOverrides?.languageCode ?? 'en',
  };

  const sampleReservation: ReservationContext = {
    confirmationNumber: reservationOverrides?.confirmationNumber ?? 'HTLXYZ123',
    checkInDate: reservationOverrides?.checkInDate ?? 'Saturday, April 15, 2026',
    checkOutDate: reservationOverrides?.checkOutDate ?? 'Monday, April 17, 2026',
    nights: reservationOverrides?.nights ?? 2,
    totalAmount: reservationOverrides?.totalAmount ?? '$450.00',
    currencyCode: reservationOverrides?.currencyCode ?? 'USD',
    specialRequests: reservationOverrides?.specialRequests ?? 'High floor, away from elevator',
  };

  const sampleRoom: RoomContext = {
    number: roomOverrides?.number ?? '501',
    type: roomOverrides?.type ?? 'Deluxe King Suite',
  };

  const sampleHotel: HotelContext = {
    name: hotelOverrides?.name ?? 'Grand Plaza Hotel',
    phone: hotelOverrides?.phone ?? '+1 555-000-1234',
    email: hotelOverrides?.email ?? 'reservations@grandplaza.com',
    address: hotelOverrides?.address ?? '123 Main Street, New York, NY 10001',
    checkInTime: hotelOverrides?.checkInTime ?? '3:00 PM',
    checkOutTime: hotelOverrides?.checkOutTime ?? '11:00 AM',
  };

  return {
    guest: sampleGuest,
    reservation: sampleReservation,
    room: sampleRoom,
    hotel: sampleHotel,
  };
}

/**
 * Build context from actual domain objects
 */
export function buildContextFromData(data: {
  guest: {
    firstName: string;
    lastName: string;
    email: string | null;
    mobile: string | null;
    languageCode: string;
  };
  reservation?: {
    confirmationNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
    nights: number;
    totalAmount: number | string;
    currencyCode?: string;
    specialRequests?: string | null;
  };
  room?: {
    number: string;
    typeName: string;
  };
  hotel?: {
    name: string;
    phone: string;
    email: string;
    addressLine1: string;
    city: string;
    stateProvince?: string | null;
    postalCode: string;
    checkInTime: Date;
    checkOutTime: Date;
  };
}): TemplateContext {
  const languageCode = data.guest.languageCode || 'en';
  const currencyCode = data.reservation?.currencyCode ?? 'USD';

  const context: TemplateContext = {
    guest: {
      firstName: data.guest.firstName,
      lastName: data.guest.lastName,
      fullName: `${data.guest.firstName} ${data.guest.lastName}`,
      email: data.guest.email,
      mobile: data.guest.mobile,
      languageCode,
    },
  };

  if (data.reservation) {
    context.reservation = {
      confirmationNumber: data.reservation.confirmationNumber,
      checkInDate: formatDate(data.reservation.checkInDate, languageCode),
      checkOutDate: formatDate(data.reservation.checkOutDate, languageCode),
      nights: data.reservation.nights,
      totalAmount: formatCurrency(data.reservation.totalAmount, currencyCode, languageCode),
      currencyCode,
      specialRequests: data.reservation.specialRequests ?? null,
    };
  }

  if (data.room) {
    context.room = {
      number: data.room.number,
      type: data.room.typeName,
    };
  }

  if (data.hotel) {
    const addressParts = [
      data.hotel.addressLine1,
      data.hotel.city,
      data.hotel.stateProvince,
      data.hotel.postalCode,
    ].filter(Boolean);

    context.hotel = {
      name: data.hotel.name,
      phone: data.hotel.phone,
      email: data.hotel.email,
      address: addressParts.join(', '),
      checkInTime: formatTime(data.hotel.checkInTime, languageCode),
      checkOutTime: formatTime(data.hotel.checkOutTime, languageCode),
    };
  }

  return context;
}

/**
 * Extract all variable names used in a template
 * Useful for validation and documentation
 */
export function extractVariables(template: string): string[] {
  const variables: Set<string> = new Set();
  let match: RegExpExecArray | null = VARIABLE_PATTERN.exec(template);

  while (match !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }

    match = VARIABLE_PATTERN.exec(template);
  }

  // Reset regex state
  VARIABLE_PATTERN.lastIndex = 0;

  return Array.from(variables);
}

/**
 * Validate that all variables in a template are known
 * Returns list of unknown variables (empty if all valid)
 */
export function validateVariables(template: string): string[] {
  const knownVariables = new Set([
    'guest.firstName',
    'guest.lastName',
    'guest.fullName',
    'guest.email',
    'guest.mobile',
    'reservation.confirmationNumber',
    'reservation.checkInDate',
    'reservation.checkOutDate',
    'reservation.nights',
    'reservation.totalAmount',
    'reservation.currencyCode',
    'reservation.specialRequests',
    'room.number',
    'room.type',
    'hotel.name',
    'hotel.phone',
    'hotel.email',
    'hotel.address',
    'hotel.checkInTime',
    'hotel.checkOutTime',
  ]);

  const usedVariables = extractVariables(template);
  return usedVariables.filter((v) => !knownVariables.has(v));
}

export const templateEngine = {
  render,
  preview,
  buildSampleContext,
  buildContextFromData,
  extractVariables,
  validateVariables,
};
