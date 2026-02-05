import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create default organization
    const org = await prisma.organization.upsert({
        where: { code: 'DEMO' },
        update: {},
        create: {
            code: 'DEMO',
            name: 'Demo Hotel Group',
            legalName: 'Demo Hotel Group Ltd',
            email: 'admin@demohotels.com',
            phone: '+1-555-0100',
            organizationType: 'CHAIN',
            subscriptionTier: 'PRO',
            subscriptionStatus: 'ACTIVE',
            maxHotels: 5,
            maxRooms: 500,
            maxUsers: 50,
            settings: {
                timezone: 'America/New_York',
                currency: 'USD',
            },
        },
    });

    console.log('✅ Organization created:', org.name);

    // Create admin user
    const admin = await prisma.user.upsert({
        where: {
            uq_user_email_org: {
                organizationId: org.id,
                email: 'admin@demohotels.com'
            }
        },
        update: {},
        create: {
            organizationId: org.id,
            email: 'admin@demohotels.com',
            passwordHash: '$2b$10$YourHashedPasswordHere', // Replace with actual hash
            firstName: 'System',
            lastName: 'Administrator',
            emailVerified: true,
            status: 'ACTIVE',
            isSuperAdmin: true,
            department: 'MANAGEMENT',
            jobTitle: 'System Administrator',
        },
    });

    console.log('✅ Admin user created:', admin.email);

    // Create demo hotel
    const hotel = await prisma.hotel.upsert({
        where: {
            uq_hotel_org_code: {
                organizationId: org.id,
                code: 'DEMO001'
            }
        },
        update: {},
        create: {
            organizationId: org.id,
            code: 'DEMO001',
            name: 'Grand Demo Hotel',
            legalName: 'Grand Demo Hotel LLC',
            email: 'reservations@granddemo.com',
            phone: '+1-555-0200',
            propertyType: 'HOTEL',
            starRating: 4.5,
            addressLine1: '123 Demo Street',
            city: 'Demo City',
            postalCode: '10001',
            countryCode: 'US',
            timezone: 'America/New_York',
            currencyCode: 'USD',
            checkInTime: new Date('1970-01-01T15:00:00Z'),
            checkOutTime: new Date('1970-01-01T11:00:00Z'),
            totalRooms: 100,
            totalFloors: 5,
            amenities: ['WIFI', 'POOL', 'SPA', 'GYM', 'RESTAURANT'],
            operationalSettings: {
                autoCheckIn: false,
                autoCheckOut: false,
            },
        },
    });

    console.log('✅ Hotel created:', hotel.name);

    // Create room types
    const roomTypes = await Promise.all([
        prisma.roomType.upsert({
            where: { id: '' }, // Will create new
            update: {},
            create: {
                organizationId: org.id,
                hotelId: hotel.id,
                code: 'STD',
                name: 'Standard Room',
                description: 'Comfortable standard room with city view',
                baseOccupancy: 2,
                maxOccupancy: 2,
                maxAdults: 2,
                maxChildren: 1,
                sizeSqm: 25,
                bedTypes: ['QUEEN'],
                amenities: ['WIFI', 'TV', 'AC', 'MINIBAR'],
                defaultCleaningTime: 30,
                isActive: true,
                isBookable: true,
                displayOrder: 1,
            },
        }),
        prisma.roomType.upsert({
            where: { id: '' },
            update: {},
            create: {
                organizationId: org.id,
                hotelId: hotel.id,
                code: 'DLX',
                name: 'Deluxe Room',
                description: 'Spacious deluxe room with premium amenities',
                baseOccupancy: 2,
                maxOccupancy: 3,
                maxAdults: 2,
                maxChildren: 2,
                sizeSqm: 35,
                bedTypes: ['KING'],
                amenities: ['WIFI', 'TV', 'AC', 'MINIBAR', 'SAFE', 'BALCONY'],
                defaultCleaningTime: 45,
                isActive: true,
                isBookable: true,
                displayOrder: 2,
            },
        }),
        prisma.roomType.upsert({
            where: { id: '' },
            update: {},
            create: {
                organizationId: org.id,
                hotelId: hotel.id,
                code: 'STE',
                name: 'Executive Suite',
                description: 'Luxury suite with separate living area',
                baseOccupancy: 2,
                maxOccupancy: 4,
                maxAdults: 3,
                maxChildren: 2,
                sizeSqm: 55,
                bedTypes: ['KING', 'SOFA_BED'],
                amenities: ['WIFI', 'TV', 'AC', 'MINIBAR', 'SAFE', 'BALCONY', 'JACUZZI'],
                defaultCleaningTime: 60,
                isActive: true,
                isBookable: true,
                displayOrder: 3,
            },
        }),
    ]);

    console.log('✅ Room types created:', roomTypes.length);

    // Create actual rooms
    const rooms = [];
    for (let floor = 1; floor <= 5; floor++) {
        for (let room = 1; room <= 20; room++) {
            const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
            const roomTypeId = room <= 8 ? roomTypes[0].id : room <= 16 ? roomTypes[1].id : roomTypes[2].id;

            rooms.push(
                prisma.room.create({
                    data: {
                        organizationId: org.id,
                        hotelId: hotel.id,
                        roomTypeId,
                        roomNumber,
                        floor,
                        status: 'VACANT_CLEAN',
                        isOutOfOrder: false,
                        isSmoking: false,
                        isAccessible: floor === 1 && room <= 4,
                        rackRate: roomTypeId === roomTypes[0].id ? 150 : roomTypeId === roomTypes[1].id ? 250 : 450,
                    },
                })
            );
        }
    }

    await Promise.all(rooms);
    console.log('✅ Rooms created:', rooms.length);

    // Create default roles
    const roles = await Promise.all([
        prisma.role.upsert({
            where: { id: '' },
            update: {},
            create: {
                organizationId: org.id,
                code: 'SUPER_ADMIN',
                name: 'Super Administrator',
                description: 'Full system access',
                isSystem: true,
                level: 100,
            },
        }),
        prisma.role.upsert({
            where: { id: '' },
            update: {},
            create: {
                organizationId: org.id,
                code: 'HOTEL_MANAGER',
                name: 'Hotel Manager',
                description: 'Manage hotel operations',
                isSystem: true,
                level: 80,
            },
        }),
        prisma.role.upsert({
            where: { id: '' },
            update: {},
            create: {
                organizationId: org.id,
                code: 'FRONT_DESK',
                name: 'Front Desk Agent',
                description: 'Handle check-ins and reservations',
                isSystem: true,
                level: 50,
            },
        }),
    ]);

    console.log('✅ Roles created:', roles.length);

    // Create permissions (simplified - expand as needed)
    const permissions = [
        'ORGANIZATION.READ', 'ORGANIZATION.CREATE', 'ORGANIZATION.UPDATE', 'ORGANIZATION.DELETE',
        'HOTEL.READ', 'HOTEL.CREATE', 'HOTEL.UPDATE', 'HOTEL.DELETE',
        'USER.READ', 'USER.CREATE', 'USER.UPDATE', 'USER.DELETE',
        'GUEST.READ', 'GUEST.CREATE', 'GUEST.UPDATE',
        'RESERVATION.READ', 'RESERVATION.CREATE', 'RESERVATION.UPDATE', 'RESERVATION.CANCEL',
        'ROOM.READ', 'ROOM.CREATE', 'ROOM.UPDATE',
        'BILLING.READ', 'BILLING.CREATE', 'BILLING.UPDATE',
        'REPORT.READ',
    ];

    for (const permCode of permissions) {
        await prisma.permission.upsert({
            where: { code: permCode },
            update: {},
            create: {
                code: permCode,
                displayName: permCode.replace('.', ' '),
                isSystem: true,
            },
        });
    }

    console.log('✅ Permissions created:', permissions.length);

    // Assign all permissions to SUPER_ADMIN
    const allPerms = await prisma.permission.findMany();
    for (const perm of allPerms) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: roles[0].id,
                    permissionId: perm.id,
                },
            },
            update: {},
            create: {
                roleId: roles[0].id,
                permissionId: perm.id,
            },
        });
    }

    console.log('✅ Permissions assigned to SUPER_ADMIN');

    // Assign role to admin user
    // Note: Using findFirst + create pattern instead of upsert because hotelId can be null
    // and the unique constraint doesn't work with null values in compound keys
    const existingUserRole = await prisma.userRole.findFirst({
        where: {
            userId: admin.id,
            roleId: roles[0].id,
            hotelId: null,
        },
    });

    if (!existingUserRole) {
        await prisma.userRole.create({
            data: {
                userId: admin.id,
                roleId: roles[0].id,
                organizationId: org.id,
                assignedBy: admin.id,
            },
        });
    }

    console.log('✅ Admin role assigned');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\nDemo credentials:');
    console.log('  Email: admin@demohotels.com');
    console.log('  Password: (check your seed file)');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });