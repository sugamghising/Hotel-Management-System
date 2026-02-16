import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';

/**
 * Middleware factory that checks if the authenticated user has required permissions
 * Usage: router.use(requirePermission('USER.CREATE', 'USER.UPDATE'))
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Check if user is authenticated (authMiddleware should run before this)
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Super admin bypass - has all permissions
    if (req.user.user.isSuperAdmin) {
      next();
      return;
    }

    const userPermissions = req.user.session.permissions;

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenError(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      );
    }

    next();
  };
};

/**
 * Middleware factory that checks if user has ANY of the required permissions (OR logic)
 * Usage: router.use(requireAnyPermission('USER.CREATE', 'ADMIN'))
 */
export const requireAnyPermission = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Super admin bypass
    if (req.user.user.isSuperAdmin) {
      next();
      return;
    }

    const userPermissions = req.user.session.permissions;

    const hasAnyPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAnyPermission) {
      throw new ForbiddenError(
        `Insufficient permissions. Need one of: ${requiredPermissions.join(', ')}`
      );
    }

    next();
  };
};

/**
 * Check permission without throwing (for conditional logic in controllers)
 */
export const hasPermission = (req: Request, ...permissions: string[]): boolean => {
  if (!req.user) return false;
  if (req.user.user.isSuperAdmin) return true;

  return permissions.every((p) => req.user?.session.permissions.includes(p) ?? false);
};

/**
 * Check if user belongs to organization
 */
export const requireOrganization = (paramName: string = 'organizationId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const orgId = req.params[paramName] || req.body[paramName];

    if (orgId && orgId !== req.user.org.id) {
      throw new ForbiddenError('Access denied for this organization');
    }

    next();
  };
};
