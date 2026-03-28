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

export class CheckinCheckoutController {
  getArrivals = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const arrivals = await checkinCheckoutService.getTodayArrivals(organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ arrivals }, "Today's arrivals retrieved"), res);
  });

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
      roomId,
      req.user?.sub,
      force
    );

    handleServiceResponse(
      ServiceResponse.success({ reservation }, 'Room assigned successfully'),
      res
    );
  });

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

  getDepartures = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const departures = await checkinCheckoutService.getTodayDepartures(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ departures }, "Today's departures retrieved"),
      res
    );
  });

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

  frontDeskDashboard = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const dashboard = await checkinCheckoutService.getFrontDeskDashboard(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ dashboard }, 'Front desk dashboard retrieved'),
      res
    );
  });

  roomGrid = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const rooms = await checkinCheckoutService.getRoomGrid(organizationId, hotelId);

    handleServiceResponse(ServiceResponse.success({ rooms }, 'Room grid retrieved'), res);
  });

  inHouse = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, hotelId } = req.params as { organizationId: string; hotelId: string };
    const reservations = await checkinCheckoutService.getInHouse(organizationId, hotelId);

    handleServiceResponse(
      ServiceResponse.success({ reservations }, 'In-house guests retrieved'),
      res
    );
  });

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
