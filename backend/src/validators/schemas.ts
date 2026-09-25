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
  .refine((value) => value === "" || /^\d{11}$/.test(value), {
    message: "CPF must contain 11 digits",
  })
  .transform((value) => (value === "" ? null : value));

export const createGuestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8).optional(),
  cpf: cpfSchema.nullable().optional(),
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

export const updateReservationSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    roomIds: z.array(z.string().min(1)).min(1).optional(),
    checkInDate: z.string().date().optional(),
    checkOutDate: z.string().date().optional(),
    guests: z.number().int().positive().optional(),
    nightlyRate: z.number().positive().optional(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      data.guestId !== undefined ||
      data.roomIds !== undefined ||
      data.checkInDate !== undefined ||
      data.checkOutDate !== undefined ||
      data.guests !== undefined ||
      data.nightlyRate !== undefined ||
      data.notes !== undefined,
    { message: "At least one field must be provided" },
  );

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

const chargeTypeEnum = z.enum([
  "ROOM",
  "MINIBAR",
  "RESTAURANT",
  "LAUNDRY",
  "SERVICE",
  "OTHER",
  "DISCOUNT",
]);

const chargeGroupEnum = z.enum(["CONSUMPTION", "SERVICE", "DISCOUNT"]);

export const createChargeCategorySchema = z.object({
  name: z.string().min(1).max(80),
  group: chargeGroupEnum,
  icon: z.string().min(1).max(40).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateChargeCategorySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    group: chargeGroupEnum.optional(),
    icon: z.string().min(1).max(40).nullable().optional(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.group !== undefined ||
      data.icon !== undefined ||
      data.active !== undefined ||
      data.position !== undefined,
    { message: "At least one field must be provided" },
  );

export const createProductSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  code: z.string().max(60).nullable().optional(),
  price: z.number().positive(),
  unit: z.string().max(20).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateProductSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    name: z.string().min(1).max(120).optional(),
    code: z.string().max(60).nullable().optional(),
    price: z.number().positive().optional(),
    unit: z.string().max(20).nullable().optional(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.categoryId !== undefined ||
      data.name !== undefined ||
      data.code !== undefined ||
      data.price !== undefined ||
      data.unit !== undefined ||
      data.active !== undefined ||
      data.position !== undefined,
    { message: "At least one field must be provided" },
  );

export const createProductsBatchSchema = z.object({
  categoryId: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        price: z.number().positive(),
        code: z.string().max(60).nullable().optional(),
        unit: z.string().max(20).nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

const productChargeSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  /// Sobrescreve a descrição só na exibição ("Coca-Cola — cortesia")
  note: z.string().max(120).optional(),
});

const manualChargeSchema = z.object({
  categoryId: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  quantity: z.number().int().positive().max(99).default(1),
});

export const createChargeSchema = z.union([
  productChargeSchema,
  manualChargeSchema,
]);

export const createChargesBatchSchema = z.object({
  items: z.array(createChargeSchema).min(1).max(50),
});

export const updateChargeSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    quantity: z.number().int().positive().max(99).optional(),
    /// Legado: ainda aceito enquanto o front antigo existir
    type: chargeTypeEnum.optional(),
  })
  .refine(
    (data) =>
      data.categoryId !== undefined ||
      data.description !== undefined ||
      data.amount !== undefined ||
      data.quantity !== undefined ||
      data.type !== undefined,
    { message: "At least one field must be provided" },
  );

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

export const extendStaySchema = z.object({
  checkOutDate: z.string().date(),
});

export const createZeladorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
});

export const updateZeladorSchema = createZeladorSchema.partial();
