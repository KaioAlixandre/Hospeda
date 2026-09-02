import { z } from "zod";

const stringList = z.array(z.string().min(1)).default([]);

const roomStatusEnum = z.enum([
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "CLEANING",
  "MAINTENANCE",
]);

export const createRoomTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().positive(),
  basePrice: z.number().positive(),
  amenities: stringList,
  photos: stringList,
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial();

export const createRoomSchema = z.object({
  number: z.string().min(1),
  floor: z.number().int().optional(),
  roomTypeId: z.string().min(1),
  capacity: z.number().int().positive().optional(),
  dailyPrice: z.number().positive().optional(),
  amenities: stringList,
  photos: stringList,
  status: roomStatusEnum.optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

const cpfSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^\d{11}$/.test(value), {
    message: "CPF must contain 11 digits",
  });

export const createGuestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8).optional(),
  cpf: cpfSchema,
  email: z.string().email().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional(),
  zipCode: z
    .string()
    .optional()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine((value) => value === undefined || /^\d{8}$/.test(value), {
      message: "CEP must contain 8 digits",
    }),
});

export const updateGuestSchema = createGuestSchema.partial();

export const createReservationSchema = z.object({
  guestId: z.string().min(1),
  roomIds: z.array(z.string().min(1)).min(1),
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
  guests: z.number().int().positive(),
  nightlyRate: z.number().positive().optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
});

export const availabilityQuerySchema = z.object({
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
  guests: z.coerce.number().int().positive(),
});

export const confirmReservationSchema = z.object({
  /// Atribui o quarto na confirmação (status do quarto → Reservado)
  roomId: z.string().min(1).optional(),
});

export const checkInSchema = z.object({
  /// Quarto a ocupar; se omitido, usa o quarto já vinculado à reserva
  roomId: z.string().min(1).optional(),
  /// Se a reserva ainda estiver pendente, confirma automaticamente no check-in
  confirm: z.boolean().default(true),
});

export const createChargeSchema = z.object({
  type: z.enum([
    "ROOM",
    "MINIBAR",
    "RESTAURANT",
    "LAUNDRY",
    "SERVICE",
    "OTHER",
    "DISCOUNT",
  ]),
  description: z.string().min(1),
  amount: z.number().positive(),
});

export const createPaymentSchema = z.object({
  method: z.enum(["PIX", "CARD", "CASH"]),
  amount: z.number().positive(),
  /// PENDING = aguardando; CONFIRMED = já recebido (parcial ou total)
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  notes: z.string().optional(),
});

export const refundPaymentSchema = z.object({
  /// Omite para estornar o valor restante integral
  amount: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const cancelPaymentSchema = z.object({}).optional();

export const checkOutSchema = z.object({
  /// Se informado, registra o pagamento confirmado do saldo e conclui o check-out
  payment: createPaymentSchema.optional(),
});

export const createZeladorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
});

export const updateZeladorSchema = createZeladorSchema.partial();
