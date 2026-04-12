import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  CancellationInput,
  CheckInInput,
  CheckOutInput,
  CreateReservationInput,
  NoShowInput,
  ReservationSearchInput,
  RoomAssignmentInput,
  SplitReservationInput,
  UpdateReservationInput,
  WalkInInput,
} from './reservations.schema';
import { reservationsService } from './reservations.service';
import type {
  CheckInInput as SvcCheckInInput,
  CheckOutInput as SvcCheckOutInput,
  CreateReservationInput as SvcCreateInput,
  NoShowInput as SvcNoShowInput,
  SplitReservationInput as SvcSplitInput,
  UpdateReservationInput as SvcUpdateInput,
  WalkInInput as SvcWalkInInput,
} from './reservations.types';

/**
 * Controller transport handlers for reservation management.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId/reservations.
 */
export class ReservationsController {
  /**
   * Handles create requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as CreateReservationInput;

    const reservation = await reservationsService.create(
      organizationId,
      hotelId,
      input as unknown as SvcCreateInput,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Reservation created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles walk in requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/walk-in
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  walkIn = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as WalkInInput;

    const reservation = await reservationsService.createWalkIn(
      organizationId,
      hotelId,
      input as unknown as SvcWalkInInput,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Walk-in reservation created', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles list requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const query = req.query as unknown as ReservationSearchInput;

    const result = await reservationsService.search(
      hotelId,
      organizationId,
      {
        ...(query.status && { status: query.status }),
        ...(query.checkInFrom && { checkInFrom: query.checkInFrom }),
        ...(query.checkInTo && { checkInTo: query.checkInTo }),
        ...(query.checkOutFrom && { checkOutFrom: query.checkOutFrom }),
        ...(query.checkOutTo && { checkOutTo: query.checkOutTo }),
        ...(query.guestName && { guestName: query.guestName }),
        ...(query.confirmationNumber && { confirmationNumber: query.confirmationNumber }),
        ...(query.roomNumber && { roomNumber: query.roomNumber }),
        ...(query.bookingSource && { bookingSource: query.bookingSource }),
      },
      { page: query.page, limit: query.limit }
    );

    handleServiceResponse(ServiceResponse.success(result, 'Reservations retrieved'), res);
  });

  /**
   * Handles get by id requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const reservation = await reservationsService.findById(reservationId, organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Reservation retrieved'), res);
  });

  /**
   * Handles get by confirmation requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/reservations/confirm/:confirmationNumber
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getByConfirmation = asyncHandler(async (req: Request, res: Response) => {
    const { confirmationNumber } = req.params as { confirmationNumber: string };
    const { organizationId } = req.query as { organizationId?: string };

    const reservation = await reservationsService.findByConfirmationNumber(
      confirmationNumber,
      organizationId
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Reservation found'), res);
  });

  /**
   * Handles update requests for reservation management.
   *
   * Route: PATCH /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as UpdateReservationInput;

    const reservation = await reservationsService.update(
      reservationId,
      organizationId,
      hotelId,
      input as unknown as SvcUpdateInput,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Reservation updated'), res);
  });

  /**
   * Handles check in requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/check-in
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkIn = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as CheckInInput;

    const reservation = await reservationsService.checkIn(
      reservationId,
      organizationId,
      hotelId,
      input as unknown as SvcCheckInInput,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Guest checked in'), res);
  });

  /**
   * Handles check out requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/check-out
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkOut = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as CheckOutInput;

    const reservation = await reservationsService.checkOut(
      reservationId,
      organizationId,
      hotelId,
      input as unknown as SvcCheckOutInput,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Guest checked out'), res);
  });

  /**
   * Handles assign room requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/assign-room
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  assignRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as RoomAssignmentInput;

    const reservation = await reservationsService.assignRoom(
      reservationId,
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Room assigned'), res);
  });

  /**
   * Handles unassign room requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/unassign-room
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  unassignRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const reservation = await reservationsService.unassignRoom(
      reservationId,
      organizationId,
      hotelId
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Room unassigned'), res);
  });

  /**
   * Handles cancel requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/cancel
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const { reason, waiveFee } = req.body as CancellationInput;

    const reservation = await reservationsService.cancel(
      reservationId,
      organizationId,
      hotelId,
      reason,
      waiveFee,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Reservation cancelled'), res);
  });

  /**
   * Handles no show requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/no-show
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  noShow = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as NoShowInput;

    const reservation = await reservationsService.markNoShow(
      reservationId,
      organizationId,
      hotelId,
      input as unknown as SvcNoShowInput,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'No-show marked'), res);
  });

  /**
   * Handles split requests for reservation management.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/split
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  split = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };
    const input = req.body as SplitReservationInput;

    const result = await reservationsService.split(
      reservationId,
      organizationId,
      hotelId,
      input as unknown as SvcSplitInput,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(result, 'Reservation split successfully'), res);
  });

  /**
   * Handles get today arrivals requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/today/arrivals
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getTodayArrivals = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const reservations = await reservationsService.getTodayArrivals(hotelId, organizationId);

    handleServiceResponse(
      ServiceResponse.success({ reservations }, 'Today arrivals retrieved'),
      res
    );
  });

  /**
   * Handles get today departures requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/today/departures
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getTodayDepartures = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const reservations = await reservationsService.getTodayDepartures(hotelId, organizationId);

    handleServiceResponse(
      ServiceResponse.success({ reservations }, 'Today departures retrieved'),
      res
    );
  });

  /**
   * Handles get in house requests for reservation management.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/in-house
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getInHouse = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };

    const guests = await reservationsService.getInHouseGuests(hotelId, organizationId);

    handleServiceResponse(ServiceResponse.success({ guests }, 'In-house guests retrieved'), res);
  });
}

export const reservationsController = new ReservationsController();
