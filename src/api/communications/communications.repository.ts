import { prisma } from '../../database/prisma';
import { Prisma } from '../../generated/prisma';
import type {
  CommunicationChannel,
  CommunicationStatus,
  CommunicationType,
} from '../../generated/prisma';
import type {
  AnalyticsQueryFilters,
  AnalyticsResponse,
  ChannelAnalytics,
  CommunicationQueryFilters,
  CommunicationResponse,
  DailyAnalytics,
  TemplateQueryFilters,
  TemplateResponse,
  TypeAnalytics,
} from './communications.types';

// ============================================================================
// COMMUNICATION REPOSITORY
// ============================================================================

export class CommunicationsRepository {
  // --------------------------------------------------------------------------
  // COMMUNICATION CRUD
  // --------------------------------------------------------------------------

  async create(data: Prisma.CommunicationCreateInput): Promise<CommunicationResponse> {
    const communication = await prisma.communication.create({
      data,
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
    });

    return this.mapCommunication(communication);
  }

  async findById(id: string): Promise<CommunicationResponse | null> {
    const communication = await prisma.communication.findUnique({
      where: { id },
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
    });

    return communication ? this.mapCommunication(communication) : null;
  }

  async findByExternalId(externalId: string): Promise<CommunicationResponse | null> {
    const communication = await prisma.communication.findFirst({
      where: { externalId },
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
    });

    return communication ? this.mapCommunication(communication) : null;
  }

  async update(id: string, data: Prisma.CommunicationUpdateInput): Promise<CommunicationResponse> {
    const communication = await prisma.communication.update({
      where: { id },
      data,
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
    });

    return this.mapCommunication(communication);
  }

  async search(
    organizationId: string,
    filters: CommunicationQueryFilters
  ): Promise<{ communications: CommunicationResponse[]; total: number }> {
    const where: Prisma.CommunicationWhereInput = {
      organizationId,
      ...(filters.guestId && { guestId: filters.guestId }),
      ...(filters.reservationId && { reservationId: filters.reservationId }),
      ...(filters.type && { type: filters.type as CommunicationType }),
      ...(filters.channel && { channel: filters.channel as CommunicationChannel }),
      ...(filters.status && { status: filters.status as CommunicationStatus }),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom && { gte: filters.dateFrom }),
              ...(filters.dateTo && { lte: filters.dateTo }),
            },
          }
        : {}),
    };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        include: {
          guest: true,
          reservation: true,
          template: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.communication.count({ where }),
    ]);

    return {
      communications: communications.map((c) => this.mapCommunication(c)),
      total,
    };
  }

  async findByReservationId(reservationId: string): Promise<CommunicationResponse[]> {
    const communications = await prisma.communication.findMany({
      where: { reservationId },
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return communications.map((c) => this.mapCommunication(c));
  }

  async findPendingScheduled(before: Date): Promise<CommunicationResponse[]> {
    const communications = await prisma.communication.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: before },
      },
      include: {
        guest: true,
        reservation: true,
        template: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return communications.map((c) => this.mapCommunication(c));
  }

  // --------------------------------------------------------------------------
  // TEMPLATE CRUD
  // --------------------------------------------------------------------------

  async createTemplate(data: Prisma.CommunicationTemplateCreateInput): Promise<TemplateResponse> {
    const template = await prisma.communicationTemplate.create({ data });
    return this.mapTemplate(template);
  }

  async findTemplateById(id: string): Promise<TemplateResponse | null> {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    return template ? this.mapTemplate(template) : null;
  }

  async findTemplateByCode(
    organizationId: string,
    code: string,
    channel: CommunicationChannel,
    language: string = 'en'
  ): Promise<TemplateResponse | null> {
    const template = await prisma.communicationTemplate.findUnique({
      where: {
        uq_template_code_channel_lang: {
          organizationId,
          code,
          channel,
          language,
        },
      },
    });

    return template ? this.mapTemplate(template) : null;
  }

  async findTemplateForSend(
    organizationId: string,
    type: CommunicationType,
    channel: CommunicationChannel,
    language: string = 'en',
    hotelId?: string
  ): Promise<TemplateResponse | null> {
    // First try to find hotel-specific template
    if (hotelId) {
      const hotelTemplate = await prisma.communicationTemplate.findFirst({
        where: {
          organizationId,
          hotelId,
          type,
          channel,
          language,
          isActive: true,
          deletedAt: null,
        },
      });

      if (hotelTemplate) {
        return this.mapTemplate(hotelTemplate);
      }
    }

    // Fall back to organization-level template
    const orgTemplate = await prisma.communicationTemplate.findFirst({
      where: {
        organizationId,
        hotelId: null,
        type,
        channel,
        language,
        isActive: true,
        deletedAt: null,
      },
    });

    if (orgTemplate) {
      return this.mapTemplate(orgTemplate);
    }

    // Fall back to 'en' if requested language not found
    if (language !== 'en') {
      return this.findTemplateForSend(organizationId, type, channel, 'en', hotelId);
    }

    return null;
  }

  async updateTemplate(
    id: string,
    data: Prisma.CommunicationTemplateUpdateInput
  ): Promise<TemplateResponse> {
    const template = await prisma.communicationTemplate.update({
      where: { id },
      data,
    });

    return this.mapTemplate(template);
  }

  async softDeleteTemplate(id: string): Promise<TemplateResponse> {
    const template = await prisma.communicationTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return this.mapTemplate(template);
  }

  async searchTemplates(
    organizationId: string,
    filters: TemplateQueryFilters
  ): Promise<{ templates: TemplateResponse[]; total: number }> {
    const where: Prisma.CommunicationTemplateWhereInput = {
      organizationId,
      deletedAt: null,
      ...(filters.type && { type: filters.type as CommunicationType }),
      ...(filters.channel && { channel: filters.channel as CommunicationChannel }),
      ...(filters.language && { language: filters.language }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.hotelId && { hotelId: filters.hotelId }),
    };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      prisma.communicationTemplate.findMany({
        where,
        orderBy: [{ type: 'asc' }, { channel: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.communicationTemplate.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapTemplate(t)),
      total,
    };
  }

  // --------------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------------

  async getAnalytics(
    organizationId: string,
    filters: AnalyticsQueryFilters
  ): Promise<AnalyticsResponse> {
    const baseWhere: Prisma.CommunicationWhereInput = {
      organizationId,
      direction: 'OUTBOUND',
      createdAt: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
      ...(filters.channel && { channel: filters.channel as CommunicationChannel }),
      ...(filters.type && { type: filters.type as CommunicationType }),
      ...(filters.hotelId && { hotelId: filters.hotelId }),
    };

    // Get summary counts
    const [totalSent, delivered, opened, failed, bounced] = await Promise.all([
      prisma.communication.count({
        where: { ...baseWhere, status: { in: ['QUEUED', 'SENT', 'DELIVERED', 'OPENED'] } },
      }),
      prisma.communication.count({
        where: { ...baseWhere, status: { in: ['DELIVERED', 'OPENED'] } },
      }),
      prisma.communication.count({
        where: { ...baseWhere, status: 'OPENED' },
      }),
      prisma.communication.count({
        where: { ...baseWhere, status: 'FAILED' },
      }),
      prisma.communication.count({
        where: { ...baseWhere, status: 'BOUNCED' },
      }),
    ]);

    // Get breakdown by channel
    const byChannelRaw = await prisma.communication.groupBy({
      by: ['channel'],
      where: baseWhere,
      _count: { id: true },
    });

    const byChannel: ChannelAnalytics[] = await Promise.all(
      byChannelRaw.map(async (row) => {
        const channelWhere = { ...baseWhere, channel: row.channel };
        const [sent, channelDelivered, channelOpened] = await Promise.all([
          prisma.communication.count({
            where: { ...channelWhere, status: { in: ['QUEUED', 'SENT', 'DELIVERED', 'OPENED'] } },
          }),
          prisma.communication.count({
            where: { ...channelWhere, status: { in: ['DELIVERED', 'OPENED'] } },
          }),
          prisma.communication.count({
            where: { ...channelWhere, status: 'OPENED' },
          }),
        ]);

        return {
          channel: row.channel,
          sent,
          delivered: channelDelivered,
          opened: channelOpened,
          deliveryRate: sent > 0 ? channelDelivered / sent : 0,
          openRate: channelDelivered > 0 ? channelOpened / channelDelivered : 0,
        };
      })
    );

    // Get breakdown by type
    const byTypeRaw = await prisma.communication.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: { id: true },
    });

    const byType: TypeAnalytics[] = await Promise.all(
      byTypeRaw.map(async (row) => {
        const typeWhere = { ...baseWhere, type: row.type };
        const [sent, typeDelivered, typeOpened] = await Promise.all([
          prisma.communication.count({
            where: { ...typeWhere, status: { in: ['QUEUED', 'SENT', 'DELIVERED', 'OPENED'] } },
          }),
          prisma.communication.count({
            where: { ...typeWhere, status: { in: ['DELIVERED', 'OPENED'] } },
          }),
          prisma.communication.count({
            where: { ...typeWhere, status: 'OPENED' },
          }),
        ]);

        return {
          type: row.type,
          sent,
          delivered: typeDelivered,
          openRate: typeDelivered > 0 ? typeOpened / typeDelivered : 0,
        };
      })
    );

    // Get daily breakdown using raw SQL for date grouping
    const byDayRaw = await prisma.$queryRaw<
      Array<{ day: Date; sent: bigint; delivered: bigint; opened: bigint; failed: bigint }>
    >`
      SELECT
        DATE(created_at) as day,
        COUNT(*) FILTER (WHERE status IN ('QUEUED', 'SENT', 'DELIVERED', 'OPENED')) as sent,
        COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'OPENED')) as delivered,
        COUNT(*) FILTER (WHERE status = 'OPENED') as opened,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed
      FROM communications
      WHERE organization_id = ${organizationId}::uuid
        AND direction = 'OUTBOUND'
        AND created_at >= ${filters.dateFrom}
        AND created_at <= ${filters.dateTo}
        ${filters.channel ? Prisma.sql`AND channel = ${filters.channel}::communication_channel` : Prisma.empty}
        ${filters.type ? Prisma.sql`AND type = ${filters.type}::communication_type` : Prisma.empty}
        ${filters.hotelId ? Prisma.sql`AND hotel_id = ${filters.hotelId}::uuid` : Prisma.empty}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;

    const byDay: DailyAnalytics[] = byDayRaw.map((row) => ({
      date: row.day instanceof Date ? row.day.toISOString().split('T')[0]! : String(row.day),
      sent: Number(row.sent),
      delivered: Number(row.delivered),
      opened: Number(row.opened),
      failed: Number(row.failed),
    }));

    return {
      period: {
        from: filters.dateFrom,
        to: filters.dateTo,
      },
      summary: {
        totalSent,
        delivered,
        opened,
        failed,
        bounced,
        deliveryRate: totalSent > 0 ? delivered / totalSent : 0,
        openRate: delivered > 0 ? opened / delivered : 0,
        failureRate: totalSent > 0 ? failed / totalSent : 0,
      },
      byChannel,
      byType,
      byDay,
    };
  }

  // --------------------------------------------------------------------------
  // MAPPERS
  // --------------------------------------------------------------------------

  private mapCommunication(
    communication: Prisma.CommunicationGetPayload<{
      include: { guest: true; reservation: true; template: true };
    }>
  ): CommunicationResponse {
    return {
      id: communication.id,
      organizationId: communication.organizationId,
      hotelId: communication.hotelId,
      guestId: communication.guestId,
      reservationId: communication.reservationId,
      type: communication.type,
      channel: communication.channel,
      direction: communication.direction,
      subject: communication.subject,
      content: communication.content,
      templateId: communication.templateId,
      status: communication.status,
      sentAt: communication.sentAt,
      deliveredAt: communication.deliveredAt,
      openedAt: communication.openedAt,
      scheduledFor: communication.scheduledFor,
      fromAddress: communication.fromAddress,
      toAddress: communication.toAddress,
      externalId: communication.externalId,
      createdAt: communication.createdAt,
    };
  }

  private mapTemplate(
    template: Prisma.CommunicationTemplateGetPayload<{
      include: Record<string, never>;
    }>
  ): TemplateResponse {
    return {
      id: template.id,
      organizationId: template.organizationId,
      hotelId: template.hotelId,
      code: template.code,
      name: template.name,
      type: template.type,
      channel: template.channel,
      subject: template.subject,
      bodyTemplate: template.bodyTemplate,
      language: template.language,
      isActive: template.isActive,
      isSystem: template.isSystem,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export const communicationsRepository = new CommunicationsRepository();
