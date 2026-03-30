import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    stack?: string | undefined;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = ReasonPhrases.BAD_REQUEST, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ReasonPhrases.UNAUTHORIZED) {
    super(message, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ReasonPhrases.FORBIDDEN) {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ReasonPhrases.NOT_FOUND) {
    super(message, StatusCodes.NOT_FOUND, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ReasonPhrases.CONFLICT) {
    super(message, StatusCodes.CONFLICT, 'CONFLICT', true);
  }
}

export class InvalidStatusError extends AppError {
  constructor(message: string = 'Invalid status transition', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'INVALID_STATUS', true, details);
  }
}

export class BlacklistedGuestError extends AppError {
  constructor(message: string = 'Guest is blacklisted', details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, 'BLACKLISTED_GUEST', true, details);
  }
}

export class NoRoomsAvailableError extends AppError {
  constructor(message: string = 'No rooms available for assignment') {
    super(message, StatusCodes.CONFLICT, 'NO_ROOMS_AVAILABLE', true);
  }
}

export class RoomNotAvailableError extends AppError {
  constructor(message: string = 'Requested room is not available', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'ROOM_NOT_AVAILABLE', true, details);
  }
}

export class OutstandingBalanceError extends AppError {
  constructor(
    message: string = 'Outstanding balance must be settled before checkout',
    details?: unknown
  ) {
    super(message, StatusCodes.CONFLICT, 'OUTSTANDING_BALANCE', true, details);
  }
}

export class ExpressCheckoutNotEligibleError extends AppError {
  constructor(
    message: string = 'Reservation is not eligible for express checkout',
    details?: unknown
  ) {
    super(message, StatusCodes.CONFLICT, 'EXPRESS_CHECKOUT_NOT_ELIGIBLE', true, details);
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(message: string = 'Invalid status transition', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'INVALID_STATUS_TRANSITION', true, details);
  }
}

export class OOOReservationConflictError extends AppError {
  constructor(
    message: string = 'Room out-of-order window conflicts with reservation schedule',
    details?: unknown
  ) {
    super(message, StatusCodes.CONFLICT, 'OOO_RESERVATION_CONFLICT', true, details);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = 'Insufficient inventory stock', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'INSUFFICIENT_STOCK', true, details);
  }
}

export class ProcurementInvalidPurchaseOrderStatusError extends AppError {
  constructor(message: string = 'Invalid purchase order status', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'PROCUREMENT_INVALID_PO_STATUS', true, details);
  }
}

export class ProcurementOverReceiptError extends AppError {
  constructor(message: string = 'Received quantity exceeds ordered quantity', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'PROCUREMENT_PO_OVER_RECEIPT', true, details);
  }
}

export class ProcurementPurchaseOrderClosedError extends AppError {
  constructor(
    message: string = 'Purchase order cannot be changed in current state',
    details?: unknown
  ) {
    super(message, StatusCodes.CONFLICT, 'PROCUREMENT_PO_CLOSED', true, details);
  }
}

export class GuestChargeAlreadyPostedError extends AppError {
  constructor(message: string = 'Guest charge already posted for this request', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'GUEST_CHARGE_ALREADY_POSTED', true, details);
  }
}

export class AssetTagAlreadyExistsError extends AppError {
  constructor(message: string = 'Asset tag already exists for this hotel', details?: unknown) {
    super(message, StatusCodes.CONFLICT, 'ASSET_TAG_ALREADY_EXISTS', true, details);
  }
}

export class ScheduleNotDueError extends AppError {
  constructor(message: string = 'Preventive schedule is not due yet', details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, 'SCHEDULE_NOT_DUE', true, details);
  }
}

export class AuditAlreadyInProgressError extends AppError {
  constructor(message: string = 'Night audit is already in progress for this hotel') {
    super(message, StatusCodes.CONFLICT, 'AUDIT_ALREADY_IN_PROGRESS', true);
  }
}

export class AuditAlreadyCompletedError extends AppError {
  constructor(businessDate?: string) {
    super(
      businessDate
        ? `Night audit already completed for businessDate ${businessDate}`
        : 'Night audit already completed for the selected business date',
      StatusCodes.CONFLICT,
      'AUDIT_ALREADY_COMPLETED',
      true
    );
  }
}

export class AuditBlockedError extends AppError {
  constructor(
    message: string = 'Cannot run audit: guests must be checked out first',
    details?: {
      uncheckedOutRes: number;
      reservationIds: string[];
    }
  ) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'AUDIT_BLOCKED', true, details);
  }
}

export class AuditRollbackNotAllowedError extends AppError {
  constructor(
    message: string = "Can only rollback the most recent audit for today's business date"
  ) {
    super(message, StatusCodes.BAD_REQUEST, 'AUDIT_ROLLBACK_NOT_ALLOWED', true);
  }
}

export class AuditStepFailedError extends AppError {
  constructor(
    details: {
      step: number;
      stepName: string;
      originalError: string;
    },
    message: string = 'Night audit step failed'
  ) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'AUDIT_STEP_FAILED', true, details);
  }
}

export class PosOrderNotOpenError extends AppError {
  constructor(status: string) {
    super(
      `Order must be OPEN for this action. Current status: ${status}`,
      StatusCodes.CONFLICT,
      'POS_ORDER_NOT_OPEN',
      true,
      { status }
    );
  }
}

export class PosOrderAlreadyVoidedError extends AppError {
  constructor(message: string = 'Order is already voided') {
    super(message, StatusCodes.CONFLICT, 'POS_ORDER_ALREADY_VOIDED', true);
  }
}

export class PosRoomPostingNotAllowedError extends AppError {
  constructor(message: string = 'Room posting is disabled for this outlet') {
    super(message, StatusCodes.CONFLICT, 'POS_ROOM_POSTING_NOT_ALLOWED', true);
  }
}

export class PosAlreadyPostedToRoomError extends AppError {
  constructor(message: string = 'Order is already posted to room') {
    super(message, StatusCodes.CONFLICT, 'POS_ALREADY_POSTED_TO_ROOM', true);
  }
}

export class PosReopenWindowExpiredError extends AppError {
  constructor(minutes: number) {
    super(
      `Reopen window of ${minutes} minutes has expired`,
      StatusCodes.CONFLICT,
      'POS_REOPEN_WINDOW_EXPIRED',
      true,
      { minutes }
    );
  }
}

export class PosSplitValidationError extends AppError {
  constructor(message: string = 'Split total must match order total', details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'POS_SPLIT_VALIDATION_FAILED', true, details);
  }
}

export class PosCreditStopError extends AppError {
  constructor(message: string = 'Guest credit stop active') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'POS_CREDIT_STOP_ACTIVE', true);
  }
}

export class PosDirectBillNotAllowedError extends AppError {
  constructor(message: string = 'Direct bill is disabled for this outlet') {
    super(message, StatusCodes.CONFLICT, 'POS_DIRECT_BILL_NOT_ALLOWED', true);
  }
}

export class PosTransferValidationError extends AppError {
  constructor(message: string = 'Invalid transfer amount', details?: unknown) {
    super(
      message,
      StatusCodes.UNPROCESSABLE_ENTITY,
      'POS_TRANSFER_VALIDATION_FAILED',
      true,
      details
    );
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = ReasonPhrases.UNPROCESSABLE_ENTITY, details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, 'UNPROCESSABLE_ENTITY', true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = ReasonPhrases.TOO_MANY_REQUESTS) {
    super(message, StatusCodes.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', true);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = ReasonPhrases.INTERNAL_SERVER_ERROR) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = ReasonPhrases.SERVICE_UNAVAILABLE) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', false);
  }
}
