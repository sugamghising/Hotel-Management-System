import { describe, expect, it, vi } from 'vitest';
import { HotelService } from '../../../src/api/hotel/hotel.service';
import { BadRequestError } from '../../../src/core/errors';

describe('HotelService.create', () => {
  const buildPersistedHotel = () => {
    const checkInTime = new Date(Date.UTC(1970, 0, 1, 15, 0, 0, 0));
    const checkOutTime = new Date(Date.UTC(1970, 0, 1, 11, 0, 0, 0));
    const now = new Date('2026-05-09T00:00:00.000Z');

    return {
      id: 'hotel-1',
      organizationId: 'org-1',
      code: 'HTL001',
      name: 'Hotel One',
      legalName: null,
      brand: null,
      starRating: null,
      propertyType: 'HOTEL',
      email: 'hotel@example.com',
      phone: '1234567890',
      fax: null,
      website: null,
      addressLine1: 'Street 1',
      addressLine2: null,
      city: 'Kathmandu',
      stateProvince: null,
      postalCode: '44600',
      countryCode: 'NP',
      latitude: null,
      longitude: null,
      timezone: 'UTC',
      checkInTime,
      checkOutTime,
      currencyCode: 'USD',
      defaultLanguage: 'en',
      totalRooms: 0,
      totalFloors: null,
      operationalSettings: {},
      amenities: [],
      policies: {},
      status: 'ACTIVE',
      openingDate: null,
      closingDate: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      lastModifiedByDevice: null,
    };
  };

  const buildCreateInput = () => ({
    code: 'htl001',
    name: 'Hotel One',
    email: 'hotel@example.com',
    phone: '1234567890',
    addressLine1: 'Street 1',
    city: 'Kathmandu',
    postalCode: '44600',
    countryCode: 'NP',
  });

  it('throws BadRequestError when organization hotel limit is exceeded', async () => {
    const hotelRepo = {
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(buildPersistedHotel()),
    };
    const orgService = {
      findById: vi.fn().mockResolvedValue({ id: 'org-1' }),
      validateLimits: vi.fn().mockResolvedValue({
        valid: false,
        message: 'hotel limit exceeded',
      }),
    };

    const service = new HotelService(
      hotelRepo as unknown as ConstructorParameters<typeof HotelService>[0],
      orgService as unknown as ConstructorParameters<typeof HotelService>[1]
    );

    await expect(service.create('org-1', buildCreateInput() as never)).rejects.toBeInstanceOf(
      BadRequestError
    );
    expect(hotelRepo.create).not.toHaveBeenCalled();
  });

  it('validates organization hotel limits before creating the hotel', async () => {
    const hotelRepo = {
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(buildPersistedHotel()),
    };
    const orgService = {
      findById: vi.fn().mockResolvedValue({ id: 'org-1' }),
      validateLimits: vi.fn().mockResolvedValue({
        valid: true,
      }),
    };

    const service = new HotelService(
      hotelRepo as unknown as ConstructorParameters<typeof HotelService>[0],
      orgService as unknown as ConstructorParameters<typeof HotelService>[1]
    );

    await expect(service.create('org-1', buildCreateInput() as never, 'admin-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'hotel-1',
        code: 'HTL001',
      })
    );

    expect(orgService.validateLimits).toHaveBeenCalledWith('org-1', 'hotel', 1);
    expect(hotelRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'HTL001',
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
      })
    );
  });
});
