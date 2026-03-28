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
            where: { uq_role_org_code: { organizationId: org.id, code: 'SUPER_ADMIN' } },
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
            where: { uq_role_org_code: { organizationId: org.id, code: 'HOTEL_MANAGER' } },
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
            where: { uq_role_org_code: { organizationId: org.id, code: 'FRONT_DESK' } },
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
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'HK_MANAGER' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'HK_MANAGER',
                name: 'Housekeeping Manager',
                description: 'Manage housekeeping operations and quality',
                isSystem: true,
                level: 70,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'HK_SUPERVISOR' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'HK_SUPERVISOR',
                name: 'Housekeeping Supervisor',
                description: 'Supervise housekeeping task execution and inspections',
                isSystem: true,
                level: 60,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'HK_STAFF' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'HK_STAFF',
                name: 'Housekeeping Staff',
                description: 'Perform room cleaning tasks',
                isSystem: true,
                level: 30,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'MAINT_MANAGER' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'MAINT_MANAGER',
                name: 'Maintenance Manager',
                description: 'Manage maintenance operations and escalations',
                isSystem: true,
                level: 70,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'MAINT_STAFF' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'MAINT_STAFF',
                name: 'Maintenance Staff',
                description: 'Execute maintenance work orders',
                isSystem: true,
                level: 40,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'GENERAL_MANAGER' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'GENERAL_MANAGER',
                name: 'General Manager',
                description: 'Operational and financial oversight across departments',
                isSystem: true,
                level: 90,
            },
        }),
        prisma.role.upsert({
            where: { uq_role_org_code: { organizationId: org.id, code: 'ACCOUNTANT' } },
            update: {},
            create: {
                organizationId: org.id,
                code: 'ACCOUNTANT',
                name: 'Accountant',
                description: 'Manage and audit billing and posted charges',
                isSystem: true,
                level: 55,
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
        'GUEST.DELETE', 'GUEST.MERGE', 'GUEST.UPDATE_VIP',
        'RESERVATION.READ', 'RESERVATION.CREATE', 'RESERVATION.UPDATE', 'RESERVATION.CANCEL',
        'RESERVATION.CHECK_IN', 'RESERVATION.CHECK_OUT', 'RESERVATION.ASSIGN_ROOM',
        'RESERVATION.NO_SHOW', 'RESERVATION.SPLIT',
        'ROOM.READ', 'ROOM.CREATE', 'ROOM.UPDATE', 'ROOM.DELETE', 'ROOM.BULK_UPDATE',
        'ROOM.STATUS_UPDATE', 'ROOM.OOO_MANAGE', 'ROOM.HISTORY_READ',
        'CHECKIN.PERFORM', 'CHECKIN.EARLY', 'CHECKIN.WALKIN',
        'CHECKIN.OVERRIDE_BLACKLIST', 'CHECKIN.WAIVE_PREAUTH',
        'CHECKOUT.PERFORM', 'CHECKOUT.EXPRESS', 'CHECKOUT.LATE',
        'CHECKOUT.NO_SHOW', 'CHECKOUT.WAIVE_FEE', 'CHECKOUT.REINSTATE',
        'ROOM.ASSIGN', 'ROOM.UPGRADE', 'ROOM.CHANGE',
        'FRONTDESK.DASHBOARD',
        'HOUSEKEEPING.READ', 'HOUSEKEEPING.CREATE', 'HOUSEKEEPING.UPDATE',
        'HOUSEKEEPING.ASSIGN', 'HOUSEKEEPING.START_TASK', 'HOUSEKEEPING.COMPLETE_TASK',
        'HOUSEKEEPING.MARK_DND', 'HOUSEKEEPING.CANCEL', 'HOUSEKEEPING.AUTO_GENERATE',
        'HOUSEKEEPING.INSPECT', 'HOUSEKEEPING.REPORT', 'HOUSEKEEPING.SHIFT_MANAGE',
        'HOUSEKEEPING.DASHBOARD_READ', 'HOUSEKEEPING.LOST_FOUND_LOG',
        'HOUSEKEEPING.LOST_FOUND_UPDATE', 'HOUSEKEEPING.LOST_FOUND_NOTIFY',
        'INVENTORY.READ', 'INVENTORY.UPDATE', 'INVENTORY.CONSUME',
        'MAINTENANCE.READ', 'MAINTENANCE.CREATE', 'MAINTENANCE.UPDATE', 'MAINTENANCE.ASSIGN',
        'MAINTENANCE.START', 'MAINTENANCE.PAUSE', 'MAINTENANCE.COMPLETE', 'MAINTENANCE.VERIFY',
        'MAINTENANCE.CANCEL', 'MAINTENANCE.ESCALATE', 'MAINTENANCE.PARTS_LOG',
        'MAINTENANCE.GUEST_CHARGE', 'MAINTENANCE.DASHBOARD_READ',
        'PREVENTIVE.READ', 'PREVENTIVE.CREATE', 'PREVENTIVE.UPDATE', 'PREVENTIVE.PAUSE',
        'PREVENTIVE.GENERATE',
        'ASSET.READ', 'ASSET.CREATE', 'ASSET.UPDATE', 'ASSET.DELETE', 'ASSET.EVALUATE',
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

    const roleByCode = Object.fromEntries(roles.map((role) => [role.code, role]));

    // Assign all permissions to SUPER_ADMIN
    const allPerms = await prisma.permission.findMany();
    for (const perm of allPerms) {
        const superAdminRole = roleByCode['SUPER_ADMIN'];
        if (!superAdminRole) {
            continue;
        }

        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: superAdminRole.id,
                    permissionId: perm.id,
                },
            },
            update: {},
            create: {
                roleId: superAdminRole.id,
                permissionId: perm.id,
            },
        });
    }

    console.log('✅ Permissions assigned to SUPER_ADMIN');

    const permissionIdByCode = Object.fromEntries(allPerms.map((perm) => [perm.code, perm.id]));

    const grantPermissions = async (roleCode: string, permissionCodes: string[]) => {
        const role = roleByCode[roleCode];
        if (!role) return;

        for (const code of permissionCodes) {
            const permissionId = permissionIdByCode[code];
            if (!permissionId) continue;

            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId,
                    },
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId,
                },
            });
        }
    };

    await grantPermissions('HOTEL_MANAGER', [
        'HOTEL.READ', 'HOTEL.UPDATE',
        'ROOM.READ', 'ROOM.CREATE', 'ROOM.UPDATE', 'ROOM.DELETE',
        'ROOM.ASSIGN', 'ROOM.UPGRADE', 'ROOM.CHANGE',
        'RESERVATION.READ', 'RESERVATION.UPDATE', 'RESERVATION.CHECK_IN', 'RESERVATION.CHECK_OUT',
        'CHECKIN.PERFORM', 'CHECKIN.EARLY', 'CHECKIN.WALKIN',
        'CHECKIN.OVERRIDE_BLACKLIST', 'CHECKIN.WAIVE_PREAUTH',
        'CHECKOUT.PERFORM', 'CHECKOUT.EXPRESS', 'CHECKOUT.LATE',
        'CHECKOUT.NO_SHOW', 'CHECKOUT.WAIVE_FEE', 'CHECKOUT.REINSTATE',
        'FRONTDESK.DASHBOARD',
        'HOUSEKEEPING.READ', 'HOUSEKEEPING.CREATE', 'HOUSEKEEPING.UPDATE', 'HOUSEKEEPING.ASSIGN',
        'HOUSEKEEPING.START_TASK', 'HOUSEKEEPING.COMPLETE_TASK', 'HOUSEKEEPING.MARK_DND',
        'HOUSEKEEPING.CANCEL', 'HOUSEKEEPING.AUTO_GENERATE', 'HOUSEKEEPING.INSPECT',
        'HOUSEKEEPING.REPORT', 'HOUSEKEEPING.SHIFT_MANAGE', 'HOUSEKEEPING.DASHBOARD_READ',
        'HOUSEKEEPING.LOST_FOUND_LOG', 'HOUSEKEEPING.LOST_FOUND_UPDATE', 'HOUSEKEEPING.LOST_FOUND_NOTIFY',
        'INVENTORY.READ', 'INVENTORY.UPDATE',
        'MAINTENANCE.READ', 'MAINTENANCE.CREATE', 'MAINTENANCE.UPDATE', 'MAINTENANCE.ASSIGN',
        'MAINTENANCE.START', 'MAINTENANCE.PAUSE', 'MAINTENANCE.COMPLETE', 'MAINTENANCE.VERIFY',
        'MAINTENANCE.CANCEL', 'MAINTENANCE.ESCALATE', 'MAINTENANCE.PARTS_LOG',
        'MAINTENANCE.GUEST_CHARGE', 'MAINTENANCE.DASHBOARD_READ',
        'PREVENTIVE.READ', 'PREVENTIVE.CREATE', 'PREVENTIVE.UPDATE', 'PREVENTIVE.PAUSE',
        'PREVENTIVE.GENERATE',
        'ASSET.READ', 'ASSET.CREATE', 'ASSET.UPDATE', 'ASSET.EVALUATE',
    ]);

    await grantPermissions('FRONT_DESK', [
        'GUEST.READ', 'GUEST.CREATE', 'GUEST.UPDATE',
        'RESERVATION.READ', 'RESERVATION.CREATE', 'RESERVATION.UPDATE',
        'RESERVATION.CHECK_IN', 'RESERVATION.CHECK_OUT',
        'CHECKIN.PERFORM', 'CHECKIN.EARLY', 'CHECKIN.WALKIN',
        'CHECKOUT.PERFORM', 'CHECKOUT.EXPRESS', 'CHECKOUT.LATE', 'CHECKOUT.NO_SHOW',
        'ROOM.READ', 'ROOM.ASSIGN', 'ROOM.CHANGE',
        'FRONTDESK.DASHBOARD',
        'HOUSEKEEPING.MARK_DND', 'HOUSEKEEPING.DASHBOARD_READ', 'HOUSEKEEPING.LOST_FOUND_LOG',
    ]);

    await grantPermissions('HK_MANAGER', [
        'HOUSEKEEPING.READ', 'HOUSEKEEPING.CREATE', 'HOUSEKEEPING.UPDATE', 'HOUSEKEEPING.ASSIGN',
        'HOUSEKEEPING.START_TASK', 'HOUSEKEEPING.COMPLETE_TASK', 'HOUSEKEEPING.MARK_DND',
        'HOUSEKEEPING.CANCEL', 'HOUSEKEEPING.AUTO_GENERATE', 'HOUSEKEEPING.INSPECT',
        'HOUSEKEEPING.REPORT', 'HOUSEKEEPING.SHIFT_MANAGE', 'HOUSEKEEPING.DASHBOARD_READ',
        'HOUSEKEEPING.LOST_FOUND_LOG', 'HOUSEKEEPING.LOST_FOUND_UPDATE', 'HOUSEKEEPING.LOST_FOUND_NOTIFY',
    ]);

    await grantPermissions('HK_SUPERVISOR', [
        'HOUSEKEEPING.READ', 'HOUSEKEEPING.CREATE', 'HOUSEKEEPING.UPDATE', 'HOUSEKEEPING.ASSIGN',
        'HOUSEKEEPING.START_TASK', 'HOUSEKEEPING.COMPLETE_TASK', 'HOUSEKEEPING.MARK_DND',
        'HOUSEKEEPING.INSPECT', 'HOUSEKEEPING.REPORT', 'HOUSEKEEPING.DASHBOARD_READ',
        'HOUSEKEEPING.LOST_FOUND_LOG', 'HOUSEKEEPING.LOST_FOUND_UPDATE',
    ]);

    await grantPermissions('HK_STAFF', [
        'HOUSEKEEPING.READ', 'HOUSEKEEPING.START_TASK', 'HOUSEKEEPING.COMPLETE_TASK',
        'HOUSEKEEPING.MARK_DND', 'HOUSEKEEPING.LOST_FOUND_LOG',
    ]);

    await grantPermissions('MAINT_MANAGER', [
        'MAINTENANCE.READ', 'MAINTENANCE.CREATE', 'MAINTENANCE.UPDATE', 'MAINTENANCE.ASSIGN',
        'MAINTENANCE.START', 'MAINTENANCE.PAUSE', 'MAINTENANCE.COMPLETE', 'MAINTENANCE.VERIFY',
        'MAINTENANCE.CANCEL', 'MAINTENANCE.ESCALATE', 'MAINTENANCE.PARTS_LOG',
        'MAINTENANCE.GUEST_CHARGE', 'MAINTENANCE.DASHBOARD_READ',
        'PREVENTIVE.READ', 'PREVENTIVE.CREATE', 'PREVENTIVE.UPDATE', 'PREVENTIVE.PAUSE',
        'PREVENTIVE.GENERATE',
        'ASSET.READ', 'ASSET.CREATE', 'ASSET.UPDATE', 'ASSET.EVALUATE',
        'INVENTORY.READ', 'INVENTORY.UPDATE', 'INVENTORY.CONSUME',
        'ROOM.OOO_MANAGE',
    ]);

    await grantPermissions('MAINT_STAFF', [
        'MAINTENANCE.READ', 'MAINTENANCE.UPDATE', 'MAINTENANCE.START', 'MAINTENANCE.PAUSE',
        'MAINTENANCE.COMPLETE', 'MAINTENANCE.PARTS_LOG',
        'PREVENTIVE.READ',
        'ASSET.READ',
        'INVENTORY.READ', 'INVENTORY.CONSUME',
    ]);

    await grantPermissions('GENERAL_MANAGER', [
        'MAINTENANCE.READ', 'MAINTENANCE.ASSIGN', 'MAINTENANCE.ESCALATE', 'MAINTENANCE.VERIFY',
        'MAINTENANCE.DASHBOARD_READ', 'MAINTENANCE.GUEST_CHARGE',
        'PREVENTIVE.READ', 'PREVENTIVE.GENERATE',
        'ASSET.READ', 'ASSET.EVALUATE',
        'REPORT.READ',
    ]);

    await grantPermissions('ACCOUNTANT', [
        'MAINTENANCE.READ', 'MAINTENANCE.DASHBOARD_READ', 'MAINTENANCE.GUEST_CHARGE',
        'BILLING.READ', 'BILLING.UPDATE', 'REPORT.READ',
    ]);

    console.log('✅ Permissions assigned to operational roles');

    // Assign role to admin user
    // Note: Using findFirst + create pattern instead of upsert because hotelId can be null
    // and the unique constraint doesn't work with null values in compound keys
    const existingUserRole = await prisma.userRole.findFirst({
        where: {
            userId: admin.id,
            roleId: roleByCode['SUPER_ADMIN'].id,
            hotelId: null,
        },
    });

    if (!existingUserRole) {
        await prisma.userRole.create({
            data: {
                userId: admin.id,
                roleId: roleByCode['SUPER_ADMIN'].id,
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