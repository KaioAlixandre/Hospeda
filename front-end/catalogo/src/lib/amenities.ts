import {
  AirVent,
  Bath,
  BedDouble,
  Car,
  Coffee,
  ConciergeBell,
  Droplets,
  Fan,
  Flame,
  Lock,
  Microwave,
  ParkingCircle,
  Refrigerator,
  ShowerHead,
  Snowflake,
  Sparkles,
  Tv,
  Utensils,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";

const RULES: Array<{ test: RegExp; icon: LucideIcon }> = [
  { test: /wi-?fi|wireless|internet/, icon: Wifi },
  { test: /ar[\s-]?cond|climat|ac\b|snow/, icon: Snowflake },
  { test: /\bar\b|ventilador|fan/, icon: Fan },
  { test: /tv|televis/, icon: Tv },
  { test: /frigo|minibar|geladeira|refriger/, icon: Refrigerator },
  { test: /estacion|parking|garagem/, icon: ParkingCircle },
  { test: /\bcar\b|ve[ií]culo/, icon: Car },
  { test: /caf[eé]|coffee|cafeteira/, icon: Coffee },
  { test: /banheira|bath/, icon: Bath },
  { test: /chuveiro|shower/, icon: ShowerHead },
  { test: /cozinha|kitchen|microondas/, icon: Microwave },
  { test: /restaurante|refei|utensil/, icon: Utensils },
  { test: /piscina|pool|waves/, icon: Waves },
  { test: /aquecedor|flame|larei/, icon: Flame },
  { test: /cofre|safe|lock/, icon: Lock },
  { test: /secador|blower|wind/, icon: Wind },
  { test: /cama|bed|roupa de cama/, icon: BedDouble },
  { test: /toalha|droplet|agua quente/, icon: Droplets },
  { test: /ar condicionado/, icon: AirVent },
  { test: /servi[cç]o|concierge/, icon: ConciergeBell },
];

export function amenityIcon(label: string): LucideIcon {
  const normalized = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(normalized)) return rule.icon;
  }
  return Sparkles;
}
