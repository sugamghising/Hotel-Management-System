import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceResponse, handleServiceResponse } from '../../common';
import { asyncHandler } from '../../core';
import type {
  CheckInRequestInput,
  CheckoutInput,
  EarlyCheckInInput,
  ExpressCheckoutInput,
  ExtendStayInput,
  LateCheckoutInput,
  NoShowInput,
  ShortenStayInput,
  WalkInCheckInInput,
} from './checkinCheckout.schema';
import { checkinCheckoutService } from './checkinCheckout.service';

/**
 * Controller transport handlers for check-in and checkout operations.
 *
 * Module base route: /api/v1/organizations/:organizationId/hotels/:hotelId.
 */
export class CheckinCheckoutController {
  /**
   * Handles get arrivals requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/checkin/arrivals
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getArrivals = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const arrivals = await checkinCheckoutService.getTodayArrivals(organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ arrivals }, "Today's arrivals retrieved"), res);
  });

  /**
   * Handles get pre check in requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/checkin/pre-checkin/:reservationId
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getPreCheckIn = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const data = await checkinCheckoutService.getPreCheckInData(
      organizationId,
      hotelId,
      reservationId
    );

    handleServiceResponse(ServiceResponse.success(data, 'Pre-check-in data retrieved'), res);
  });

  /**
   * Handles check in requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkin
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

    const input = req.body as CheckInRequestInput;
    const data = await checkinCheckoutService.checkIn(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Check-in completed successfully'), res);
  });

  /**
   * Handles early check in requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkin/early
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  earlyCheckIn = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as EarlyCheckInInput;
    const data = await checkinCheckoutService.earlyCheckIn(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(data, 'Early check-in completed successfully'),
      res
    );
  });

  /**
   * Handles walk in check in requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/checkin/walkin
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkin/walkin
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  walkInCheckIn = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const input = req.body as WalkInCheckInInput;

    const data = await checkinCheckoutService.walkInCheckIn(
      organizationId,
      hotelId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(data, 'Walk-in check-in completed successfully', StatusCodes.CREATED),
      res
    );
  });

  /**
   * Handles assign room requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/rooms/assign
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

    const { roomId, force } = req.body as { roomId: string; force?: boolean };
    const reservation = await checkinCheckoutService.assignRoom(
      organizationId,
      hotelId,
      reservationId,
      { roomId, ...(force !== undefined ? { force } : {}) },
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Room assigned successfully'),
      res
    );
  });

  /**
   * Handles auto assign room requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/rooms/auto-assign
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  autoAssignRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const data = await checkinCheckoutService.autoAssignRoom(
      organizationId,
      hotelId,
      reservationId,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Room auto-assigned successfully'), res);
  });

  /**
   * Handles upgrade room requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/rooms/upgrade
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  upgradeRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const { roomId, upgradeFee, upgradeReason } = req.body as {
      roomId: string;
      upgradeFee?: number;
      upgradeReason?: string;
    };
    const reservation = await checkinCheckoutService.upgradeRoom(
      organizationId,
      hotelId,
      reservationId,
      roomId,
      req.user?.sub,
      upgradeFee,
      upgradeReason
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Room upgraded successfully'),
      res
    );
  });

  /**
   * Handles change room requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/rooms/change
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  changeRoom = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const { roomId, changeReason } = req.body as { roomId: string; changeReason?: string };
    const reservation = await checkinCheckoutService.changeRoom(
      organizationId,
      hotelId,
      reservationId,
      roomId,
      req.user?.sub,
      changeReason
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Room changed successfully'),
      res
    );
  });

  /**
   * Handles get departures requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/checkout/departures
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  getDepartures = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const departures = await checkinCheckoutService.getTodayDepartures(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ departures }, "Today's departures retrieved"),
      res
    );
  });

  /**
   * Handles checkout preview requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkout/preview
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkoutPreview = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const data = await checkinCheckoutService.checkoutPreview(
      organizationId,
      hotelId,
      reservationId
    );
    handleServiceResponse(ServiceResponse.success(data, 'Checkout preview retrieved'), res);
  });

  /**
   * Handles checkout requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkout
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  checkout = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as CheckoutInput;
    const data = await checkinCheckoutService.checkOut(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success(data, 'Checkout completed successfully'), res);
  });

  /**
   * Handles express checkout requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkout/express
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  expressCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as ExpressCheckoutInput;
    const data = await checkinCheckoutService.expressCheckout(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success(data, 'Express checkout completed successfully'),
      res
    );
  });

  /**
   * Handles late checkout requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/checkout/late
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  lateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as LateCheckoutInput;
    const reservation = await checkinCheckoutService.lateCheckout(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Late checkout processed successfully'),
      res
    );
  });

  /**
   * Handles mark no show requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/no-show
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  markNoShow = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as NoShowInput;
    const reservation = await checkinCheckoutService.markNoShow(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Reservation marked as no-show'),
      res
    );
  });

  /**
   * Handles reinstate requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/reinstate
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  reinstate = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const { reason } = req.body as { reason: string };
    const reservation = await checkinCheckoutService.reinstate(
      organizationId,
      hotelId,
      reservationId,
      reason,
      req.user?.sub
    );

    handleServiceResponse(ServiceResponse.success({ reservation }, 'Reservation reinstated'), res);
  });

  /**
   * Handles front desk dashboard requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/front-desk/dashboard
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  frontDeskDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const dashboard = await checkinCheckoutService.getFrontDeskDashboard(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Front desk dashboard retrieved'),
      res
    );
  });

  /**
   * Handles room grid requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/front-desk/room-grid
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  roomGrid = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const rooms = await checkinCheckoutService.getRoomGrid(organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ rooms }, 'Room grid retrieved'), res);
  });

  /**
   * Handles in house requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/in-house
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  inHouse = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const reservations = await checkinCheckoutService.getInHouse(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ reservations }, 'In-house guests retrieved'),
      res
    );
  });

  /**
   * Handles reservation status requests for check-in and checkout operations.
   *
   * Route: GET /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/status
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  reservationStatus = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const status = await checkinCheckoutService.getReservationStatus(
      organizationId,
      hotelId,
      reservationId
    );

    handleServiceResponse(ServiceResponse.success(status, 'Reservation status retrieved'), res);
  });

  /**
   * Handles extend stay requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/extend
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  extendStay = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as ExtendStayInput;
    const reservation = await checkinCheckoutService.extendStay(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Stay extended successfully'),
      res
    );
  });

  /**
   * Handles shorten stay requests for check-in and checkout operations.
   *
   * Route: POST /api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/shorten
   *
   * Converts query string, route params, and body values to typed arguments and forwards to the service aggregation/operation flow.
   * This controller method is a transport wrapper only (no direct DB reads or logging).
   *
   * @param req - Express request with route scope and validated filters/payload.
   * @param res - Express response used by `handleServiceResponse`.
   */
  shortenStay = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId, reservationId } = req.params as {
      organizationId: string;
      hotelId: string;
      reservationId: string;
    };

    const input = req.body as ShortenStayInput;
    const reservation = await checkinCheckoutService.shortenStay(
      organizationId,
      hotelId,
      reservationId,
      input,
      req.user?.sub
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Stay shortened successfully'),
      res
    );
  });
}

export const checkinCheckoutController = new CheckinCheckoutController();
