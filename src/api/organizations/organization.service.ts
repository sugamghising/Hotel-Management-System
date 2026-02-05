import { logger } from '../../core';
import { OrganizationRepository } from './organization.repository';

export class OrganizationService {
  private organizationRepository: OrganizationRepository;

  constructor(organizationRepo: OrganizationRepository = new OrganizationRepository()) {
    this.organizationRepository = organizationRepo;
  }

  /**
   * Get all organizations with pagination and filters
   */
  async findAll(query: {
    skip?: number;
    take?: number;
    search?: string;
    status?: string;
    type?: string;
  }) {
    try {
      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      if (query.search) {
        where['OR'] = [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { code: { contains: query.search, mode: 'insensitive' as const } },
        ];
      }

      if (query.status) {
        where['subscriptionStatus'] = query.status;
      }

      if (query.type) {
        where['organizationType'] = query.type;
      }

      const [data, total] = await Promise.all([
        this.organizationRepository.findMany({
          where,
          skip: query.skip || 0,
          take: query.take || 10,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                hotels: true,
                users: true,
              },
            },
          },
        }),
        this.organizationRepository.count(where),
      ]);

      logger.debug(`Found ${total} organizations`, { filters: query });

      return { data, total };
    } catch (error) {
      logger.error('Failed to fetch organizations', { error, query });
      throw error;
    }
  }
}
