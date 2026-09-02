import { buildBill, presentPayment } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

async function loadReservationForBill(hotelId: string, reservationId: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: { charges: true, payments: true },
  });
  if (!reservation) throw new AppError(404, "Reservation not found");
  return reservation;
}

async function loadPaymentForHotel(hotelId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, reservation: { hotelId } },
    include: { refunds: true },
  });
  if (!payment) throw new AppError(404, "Payment not found");
  return payment;
}

export async function listPayments(hotelId: string, reservationId: string) {
  const reservation = await loadReservationForBill(hotelId, reservationId);
  const payments = await prisma.payment.findMany({
    where: { reservationId },
    orderBy: { createdAt: "asc" },
  });

  return {
    reservationId,
    bill: buildBill(reservation),
    payments: payments.map(presentPayment),
  };
}

export async function createPayment(input: {
  hotelId: string;
  reservationId: string;
  method: "PIX" | "CARD" | "CASH";
  amount: number;
  status?: "PENDING" | "CONFIRMED";
  notes?: string;
}) {
  const reservation = await loadReservationForBill(
    input.hotelId,
    input.reservationId,
  );
  if (["CANCELLED", "COMPLETED"].includes(reservation.status)) {
    throw new AppError(400, "Cannot add payments to this reservation");
  }

  const bill = buildBill(reservation);
  const status = input.status ?? defaultStatus(input.method);

  if (status === "CONFIRMED" && input.amount > bill.balance + 0.001) {
    throw new AppError(
      400,
      `Payment amount exceeds outstanding balance of ${bill.balance}`,
    );
  }

  const payment = await prisma.payment.create({
    data: {
      reservationId: input.reservationId,
      method: input.method,
      amount: input.amount,
      status,
      notes: input.notes,
      paidAt: status === "CONFIRMED" ? new Date() : null,
    },
  });

  const updated = await loadReservationForBill(
    input.hotelId,
    input.reservationId,
  );

  return {
    payment: presentPayment(payment),
    bill: buildBill(updated),
  };
}

function defaultStatus(method: "PIX" | "CARD" | "CASH"): "PENDING" | "CONFIRMED" {
  return method === "CASH" ? "CONFIRMED" : "PENDING";
}

export async function confirmPayment(hotelId: string, paymentId: string) {
  const payment = await loadPaymentForHotel(hotelId, paymentId);
  if (payment.status !== "PENDING") {
    throw new AppError(400, "Only pending payments can be confirmed");
  }

  const reservation = await loadReservationForBill(
    hotelId,
    payment.reservationId,
  );
  const bill = buildBill(reservation);
  if (Number(payment.amount) > bill.balance + 0.001) {
    throw new AppError(
      400,
      `Payment amount exceeds outstanding balance of ${bill.balance}`,
    );
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "CONFIRMED",
      paidAt: new Date(),
    },
  });

  const updatedReservation = await loadReservationForBill(
    hotelId,
    payment.reservationId,
  );

  return {
    payment: presentPayment(updatedPayment),
    bill: buildBill(updatedReservation),
  };
}

export async function cancelPayment(hotelId: string, paymentId: string) {
  const payment = await loadPaymentForHotel(hotelId, paymentId);
  if (payment.status !== "PENDING") {
    throw new AppError(400, "Only pending payments can be cancelled");
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  const reservation = await loadReservationForBill(
    hotelId,
    payment.reservationId,
  );

  return {
    payment: presentPayment(updatedPayment),
    bill: buildBill(reservation),
  };
}

export async function refundPayment(
  hotelId: string,
  paymentId: string,
  input: { amount?: number; notes?: string } = {},
) {
  const payment = await loadPaymentForHotel(hotelId, paymentId);
  if (payment.status !== "CONFIRMED") {
    throw new AppError(400, "Only confirmed payments can be refunded");
  }
  if (payment.refundOfId) {
    throw new AppError(400, "Cannot refund a refund record");
  }

  const alreadyRefunded = payment.refunds
    .filter((r) => r.status === "REFUNDED")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = Number((Number(payment.amount) - alreadyRefunded).toFixed(2));

  if (refundable <= 0) {
    throw new AppError(400, "Payment already fully refunded");
  }

  const refundAmount = input.amount ?? refundable;
  if (refundAmount <= 0) {
    throw new AppError(400, "Refund amount must be positive");
  }
  if (refundAmount > refundable + 0.001) {
    throw new AppError(400, `Maximum refundable amount is ${refundable}`);
  }

  const refund = await prisma.payment.create({
    data: {
      reservationId: payment.reservationId,
      method: payment.method,
      amount: refundAmount,
      status: "REFUNDED",
      refundOfId: payment.id,
      refundedAt: new Date(),
      notes: input.notes ?? `Estorno de pagamento ${payment.id}`,
    },
  });

  const reservation = await loadReservationForBill(
    hotelId,
    payment.reservationId,
  );

  return {
    payment: presentPayment(payment),
    refund: presentPayment(refund),
    refundedAmount: refundAmount,
    remainingOnPayment: Number((refundable - refundAmount).toFixed(2)),
    bill: buildBill(reservation),
  };
}
