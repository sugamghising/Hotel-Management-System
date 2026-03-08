import { prisma } from '../../database/prisma';
import type { Prisma } from '../../generated/prisma';
import type {
  DuplicateDetectionInput,
  Guest,
  GuestDuplicate,
  GuestQueryFilters,
  GuestStayHistory,
} from './guests.types';

type GuestWithRelations = Prisma.GuestGetPayload<{
  include: {
    reservations: {
      include: {
        hotel: true;
        rooms: {
          include: {
            roomType: true;
            room: true;
          };
        };
        ratePlan: true;
      };
    };
    communications: true;
  };
}>;

export type GuestWhereInput = Prisma.GuestWhereInput;
export type GuestCreateInput = Prisma.GuestCreateInput;
export type GuestUpdateInput = Prisma.GuestUpdateInput;

type GuestRow = Prisma.GuestGetPayload<Record<string, never>>;

type ReservationForHistory = Prisma.ReservationGetPayload<{
  include: {
    hotel: true;
    rooms: {
      include: {
        roomType: true;
        room: true;
      };
    };
    ratePlan: true;
  };
}>;

type InHouseReservation = Prisma.ReservationGetPayload<{
  include: {
    guest: true;
    rooms: {
      include: {
        room: true;
        roomType: true;
      };
    };
    folioItems: true;
    payments: true;
  };
}>;

interface GuestStats {
  totalGuests: number;
  byVIPStatus: Record<string, number>;
  byGuestType: Record<string, number>;
  byNationality: unknown;
  topCompanies: unknown;
  returningGuests: number;
}

export class GuestsRepository {
  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async findById(id: string): Promise<Guest | null> {
    return prisma.guest.findUnique({
      where: { id },
    }) as Promise<Guest | null>;
  }

  async findByIdWithReservations(id: string): Promise<GuestWithRelations | null> {
    return prisma.guest.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { deletedAt: null },
          orderBy: { checkInDate: 'desc' },
          include: {
            hotel: true,
            rooms: {
              include: {
                roomType: true,
                room: true,
              },
            },
            ratePlan: true,
          },
        },
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  async findByEmail(organizationId: string, email: string): Promise<Guest | null> {
    return prisma.guest.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
        deletedAt: null,
      },
    }) as Promise<Guest | null>;
  }

  async findByOrganization(
    organizationId: string,
    filters?: GuestQueryFilters,
    pagination?: { page: number; limit: number }
  ): Promise<{ guests: Guest[]; total: number }> {
    const where: Prisma.GuestWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (filters?.search) {
      const search = filters.search;
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search.toLowerCase() } },
            { phone: { contains: search } },
            { mobile: { contains: search } },
            { companyName: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filters?.vipStatus) {
      where.vipStatus = filters.vipStatus;
    }

    if (filters?.guestType) {
      where.guestType = filters.guestType;
    }

    if (filters?.companyName) {
      where.companyName = { contains: filters.companyName, mode: 'insensitive' };
    }

    if (filters?.hasEmail !== undefined) {
      where.email = filters.hasEmail ? { not: null } : null;
    }

    if (filters?.hasPhone !== undefined) {
      if (filters.hasPhone) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { OR: [{ phone: { not: null } }, { mobile: { not: null } }] },
        ];
      } else {
        where.phone = null;
        where.mobile = null;
      }
    }

    if (filters?.lastStayAfter && filters?.lastStayBefore) {
      where.lastStayDate = { gte: filters.lastStayAfter, lte: filters.lastStayBefore };
    } else if (filters?.lastStayAfter) {
      where.lastStayDate = { gte: filters.lastStayAfter };
    } else if (filters?.lastStayBefore) {
      where.lastStayDate = { lte: filters.lastStayBefore };
    }

    if (filters?.minStays !== undefined) {
      where.totalStays = { gte: filters.minStays };
    }

    if (filters?.minRevenue !== undefined) {
      where.totalRevenue = { gte: filters.minRevenue };
    }

    if (filters?.marketingConsent !== undefined) {
      where.marketingConsent = filters.marketingConsent;
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        ...(pagination
          ? { skip: (pagination.page - 1) * pagination.limit, take: pagination.limit }
          : {}),
        orderBy: [{ vipStatus: 'desc' }, { lastStayDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.guest.count({ where }),
    ]);

    return { guests: guests as unknown as Guest[], total };
  }

  async create(data: GuestCreateInput): Promise<Guest> {
    return prisma.guest.create({ data }) as unknown as Promise<Guest>;
  }

  async update(id: string, data: GuestUpdateInput): Promise<Guest> {
    return prisma.guest.update({
      where: { id },
      data,
    }) as unknown as Promise<Guest>;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.guest.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: null, // Clear PII
        phone: null,
        mobile: null,
        idNumber: null,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // DUPLICATE DETECTION
  // ============================================================================

  async findPotentialDuplicates(
    organizationId: string,
    input: DuplicateDetectionInput
  ): Promise<GuestDuplicate[]> {
    // Build query for potential matches
    const where: Prisma.GuestWhereInput = {
      organizationId,
      deletedAt: null,
      AND: [
        {
          OR: [
            { firstName: { contains: input.firstName, mode: 'insensitive' } },
            { lastName: { contains: input.lastName, mode: 'insensitive' } },
          ],
        },
      ],
    };

    // Add email/phone matching if provided
    const contactConditions: Prisma.GuestWhereInput[] = [];
    if (input.email) {
      contactConditions.push({ email: input.email.toLowerCase() });
    }
    if (input.phone) {
      contactConditions.push({ phone: input.phone }, { mobile: input.phone });
    }
    if (input.mobile) {
      contactConditions.push({ mobile: input.mobile }, { phone: input.mobile });
    }

    if (contactConditions.length > 0) {
      where.OR = contactConditions;
    }

    const candidates = await prisma.guest.findMany({
      where,
      take: 20, // Limit candidates for scoring
    });

    // Score and filter candidates
    const scored = candidates
      .map((guest) => {
        const score = this.calculateDuplicateScore(guest, input);
        return {
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
          mobile: guest.mobile,
          matchScore: score.score,
          matchReasons: score.reasons,
        };
      })
      .filter((g) => g.matchScore >= (input.threshold ?? 70));

    // Sort by score descending
    scored.sort((a, b) => b.matchScore - a.matchScore);

    return scored.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      phone: g.phone ?? g.mobile,
      matchScore: g.matchScore,
      matchReasons: g.matchReasons,
    }));
  }

  private calculateDuplicateScore(
    guest: GuestRow,
    input: DuplicateDetectionInput
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Name matching (0-40 points)
    const firstNameMatch = this.nameSimilarity(guest.firstName, input.firstName);
    const lastNameMatch = this.nameSimilarity(guest.lastName, input.lastName);

    if (firstNameMatch > 0.8 && lastNameMatch > 0.8) {
      score += 40;
      reasons.push('Exact name match');
    } else if (firstNameMatch > 0.6 && lastNameMatch > 0.6) {
      score += 25;
      reasons.push('Similar name');
    } else if (lastNameMatch > 0.8) {
      score += 15;
      reasons.push('Same last name');
    }

    // Email match (0-30 points)
    if (input.email && guest.email) {
      if (guest.email.toLowerCase() === input.email.toLowerCase()) {
        score += 30;
        reasons.push('Exact email match');
      }
    }

    // Phone match (0-20 points)
    const guestPhone = guest.phone || guest.mobile;
    const inputPhone = input.phone || input.mobile;
    if (inputPhone && guestPhone) {
      const normalizedGuest = guestPhone.replace(/\D/g, '');
      const normalizedInput = inputPhone.replace(/\D/g, '');
      if (normalizedGuest === normalizedInput) {
        score += 20;
        reasons.push('Phone number match');
      }
    }

    // Date of birth match (0-10 points)
    if (input.dateOfBirth && guest.dateOfBirth) {
      const inputDate = new Date(input.dateOfBirth).toISOString().split('T')[0];
      const guestDate = new Date(guest.dateOfBirth).toISOString().split('T')[0];
      if (inputDate === guestDate) {
        score += 10;
        reasons.push('Same date of birth');
      }
    }

    return { score: Math.min(100, score), reasons };
  }

  private nameSimilarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().trim();
    const na = normalize(a);
    const nb = normalize(b);

    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.8;

    // Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(na, nb);
    const maxLen = Math.max(na.length, nb.length);
    return Math.max(0, 1 - distance / maxLen);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cur = matrix[i];
        const prev = matrix[i - 1];
        if (!cur || !prev) continue;
        cur[j] =
          b.charAt(i - 1) === a.charAt(j - 1)
            ? (prev[j - 1] ?? 0)
            : Math.min((prev[j - 1] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1);
      }
    }
    const lastRow = matrix[b.length];
    return lastRow ? (lastRow[a.length] ?? 0) : 0;
  }

  // ============================================================================
  // MERGE OPERATIONS
  // ============================================================================

  async mergeGuests(
    targetId: string,
    sourceIds: string[],
    strategy: { keepSourceIfNewer: boolean; preferSourceFields: string[] }
  ): Promise<Guest> {
    return prisma.$transaction(async (tx) => {
      // Get all guests
      const [target, ...sources] = await Promise.all([
        tx.guest.findUnique({ where: { id: targetId } }),
        ...sourceIds.map((id) => tx.guest.findUnique({ where: { id } })),
      ]);

      if (!target) throw new Error('Target guest not found');
      if (sources.some((s) => !s)) throw new Error('Source guest not found');

      // Merge data based on strategy
      const mergedData = this.mergeGuestData(target, sources as GuestRow[], strategy);

      // Update target with merged data
      const updated = await tx.guest.update({
        where: { id: targetId },
        data: {
          ...mergedData,
          // Aggregate statistics
          totalStays: target.totalStays + sources.reduce((sum, s) => sum + (s?.totalStays || 0), 0),
          totalNights:
            target.totalNights + sources.reduce((sum, s) => sum + (s?.totalNights || 0), 0),
          totalRevenue:
            Number.parseFloat(target.totalRevenue.toString()) +
            sources.reduce(
              (sum, s) => sum + Number.parseFloat((s?.totalRevenue || 0).toString()),
              0
            ),
          // Keep most recent stay date
          lastStayDate:
            [target.lastStayDate, ...sources.map((s) => s?.lastStayDate)]
              .filter((d): d is Date => d != null)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
          updatedAt: new Date(),
        } as unknown as Prisma.GuestUpdateInput,
      });

      // Reassign all reservations to target
      await tx.reservation.updateMany({
        where: { guestId: { in: sourceIds } },
        data: { guestId: targetId },
      });

      // Reassign communications
      await tx.communication.updateMany({
        where: { guestId: { in: sourceIds } },
        data: { guestId: targetId },
      });

      // Soft delete source guests
      await Promise.all(
        sourceIds.map((id) =>
          tx.guest.update({
            where: { id },
            data: {
              deletedAt: new Date(),
              email: null,
              phone: null,
              mobile: null,
              idNumber: null,
            },
          })
        )
      );

      return updated as unknown as Guest;
    });
  }

  private mergeGuestData(
    target: GuestRow,
    sources: GuestRow[],
    strategy: { keepSourceIfNewer: boolean; preferSourceFields: string[] }
  ): Partial<GuestRow> {
    const result: Record<string, unknown> = {};
    const t = target as Record<string, unknown>;
    const srcs = sources as Record<string, unknown>[];
    const fieldsToMerge = [
      'email',
      'phone',
      'mobile',
      'addressLine1',
      'addressLine2',
      'city',
      'stateProvince',
      'postalCode',
      'countryCode',
      'idType',
      'idNumber',
      'idExpiryDate',
      'companyName',
      'companyTaxId',
      'roomPreferences',
      'dietaryRequirements',
      'specialNeeds',
      'internalNotes',
      'alertNotes',
    ];

    for (const field of fieldsToMerge) {
      // Check if field is in preferSourceFields
      if (strategy.preferSourceFields.includes(field)) {
        // Use first source that has this field
        const sourceValue = srcs.find((s) => s[field])?.[field];
        result[field] = sourceValue !== undefined && sourceValue !== null ? sourceValue : t[field];
      } else if (strategy.keepSourceIfNewer) {
        // Use source if it has newer updatedAt
        const newestSource = srcs
          .filter((s) => s[field] !== null && s[field] !== undefined)
          .sort(
            (a, b) =>
              new Date(b['updatedAt'] as Date).getTime() -
              new Date(a['updatedAt'] as Date).getTime()
          )[0];

        result[field] = newestSource?.[field] ?? t[field];
      } else {
        // Keep target value unless null
        result[field] = t[field] ?? srcs.find((s) => s[field])?.[field];
      }
    }

    return result as Partial<GuestRow>;
  }

  // ============================================================================
  // STAY HISTORY
  // ============================================================================

  async getStayHistory(guestId: string): Promise<GuestStayHistory[]> {
    const reservations = await prisma.reservation.findMany({
      where: {
        guestId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      orderBy: { checkInDate: 'desc' },
      include: {
        hotel: true,
        rooms: {
          include: {
            roomType: true,
            room: true,
          },
        },
        ratePlan: true,
      },
    });

    return (reservations as ReservationForHistory[]).map((res) => ({
      reservationId: res.id,
      confirmationNumber: res.confirmationNumber,
      hotelId: res.hotelId,
      hotelName: res.hotel.name,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      nights: res.nights,
      roomType: res.rooms[0]?.roomType?.name || 'Unknown',
      roomNumber: res.rooms[0]?.room?.roomNumber || null,
      ratePlan: res.ratePlan?.name || 'Unknown',
      totalAmount: Number.parseFloat(res.totalAmount.toString()),
      status: res.status,
      notes: res.internalNotes,
    }));
  }

  // ============================================================================
  // IN-HOUSE GUESTS
  // ============================================================================

  async getInHouseGuests(hotelId: string, businessDate: Date): Promise<InHouseReservation[]> {
    return prisma.reservation.findMany({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        checkInDate: { lte: businessDate },
        checkOutDate: { gt: businessDate },
        deletedAt: null,
      },
      include: {
        guest: true,
        rooms: {
          include: {
            room: true,
            roomType: true,
          },
        },
        folioItems: {
          where: { isVoided: false },
        },
        payments: {
          where: { status: { in: ['CAPTURED', 'AUTHORIZED'] } },
        },
      },
      orderBy: { guest: { vipStatus: 'desc' } },
    });
  }

  // ============================================================================
  // STATISTICS & ANALYTICS
  // ============================================================================

  async getStats(organizationId: string): Promise<GuestStats> {
    const [totalGuests, byVIPStatus, byGuestType, byNationality, topCompanies, returningGuests] =
      await Promise.all([
        // Total guests
        prisma.guest.count({
          where: { organizationId, deletedAt: null },
        }),

        // By VIP status
        prisma.guest.groupBy({
          by: ['vipStatus'],
          where: { organizationId, deletedAt: null },
          _count: { vipStatus: true },
        }),

        // By guest type
        prisma.guest.groupBy({
          by: ['guestType'],
          where: { organizationId, deletedAt: null },
          _count: { guestType: true },
        }),

        // By nationality (top 10)
        prisma.$queryRaw`
        SELECT nationality as country, COUNT(*) as count
        FROM guests
        WHERE organization_id = ${organizationId}::uuid
          AND deleted_at IS NULL
          AND nationality IS NOT NULL
        GROUP BY nationality
        ORDER BY count DESC
        LIMIT 10
      `,

        // Top companies
        prisma.$queryRaw`
        SELECT 
          company_name as name,
          COUNT(*) as "guestCount",
          SUM(total_revenue) as "totalRevenue"
        FROM guests
        WHERE organization_id = ${organizationId}::uuid
          AND deleted_at IS NULL
          AND company_name IS NOT NULL
        GROUP BY company_name
        ORDER BY "guestCount" DESC
        LIMIT 10
      `,

        // Returning guests (2+ stays)
        prisma.guest.count({
          where: {
            organizationId,
            deletedAt: null,
            totalStays: { gte: 2 },
          },
        }),
      ]);

    return {
      totalGuests,
      byVIPStatus: byVIPStatus.reduce((acc: Record<string, number>, curr) => {
        acc[curr.vipStatus] = curr._count.vipStatus;
        return acc;
      }, {}),
      byGuestType: byGuestType.reduce((acc: Record<string, number>, curr) => {
        acc[curr.guestType] = curr._count.guestType;
        return acc;
      }, {}),
      byNationality,
      topCompanies,
      returningGuests,
    };
  }

  // ============================================================================
  // HISTORY UPDATE (called by reservation lifecycle)
  // ============================================================================

  async updateHistoryFromReservation(
    guestId: string,
    reservationData: {
      nights: number;
      totalAmount: number;
      checkOutDate: Date;
    }
  ): Promise<void> {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) return;

    const currentTotal = Number.parseFloat(guest.totalRevenue.toString());
    const newTotal = Number.parseFloat(reservationData.totalAmount.toString());
    const totalRevenue = currentTotal + newTotal;
    const totalStays = guest.totalStays + 1;
    const totalNights = guest.totalNights + reservationData.nights;
    const averageRate = totalRevenue / totalNights;

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        totalStays,
        totalNights,
        totalRevenue,
        lastStayDate: reservationData.checkOutDate,
        averageRate,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  async existsInOrganization(organizationId: string, guestId: string): Promise<boolean> {
    const count = await prisma.guest.count({
      where: {
        id: guestId,
        organizationId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async hasActiveReservations(guestId: string): Promise<boolean> {
    const count = await prisma.reservation.count({
      where: {
        guestId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkOutDate: { gte: new Date() },
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async isBlacklisted(_guestId: string): Promise<{ blacklisted: boolean; reason: string | null }> {
    // Would check blacklist table in full implementation
    return { blacklisted: false, reason: null };
  }
}

export const guestsRepository = new GuestsRepository();
