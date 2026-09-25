/*
  Monta e imprime o cupom térmico com detalhes da reserva (StayDesck).
  Baseado no fluxo do Mira-Printer (linhas + print_receipt_output).
*/

const { loadPrintEnv, printReceipt } = require("./print_receipt_output");

function parsePayload() {
  const raw = process.env.STAYDESCK_PRINT_JSON || process.env.HOSPEDA_PRINT_JSON || process.env.AUTO_PRINT_ORDER_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function brl(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function dateBR(value) {
  if (!value) return "-";
  const text = String(value);
  const day = text.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text;
  return d.toLocaleDateString("pt-BR");
}

function dateTimeBR(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function formatCnpj(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length !== 14) return digits;
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  );
}

function padRight(value, width) {
  const s = String(value ?? "");
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

function center(text, width) {
  const s = String(text ?? "").trim();
  if (s.length >= width) return s.slice(0, width);
  const left = Math.floor((width - s.length) / 2);
  return " ".repeat(left) + s;
}

function sectionHeader(label, width) {
  const inner = ` ${label} `;
  if (inner.length >= width) return label.slice(0, width);
  const sideLen = Math.floor((width - inner.length) / 2);
  return (
    "-".repeat(sideLen) +
    inner +
    "-".repeat(width - sideLen - inner.length)
  );
}

function moneyRow(label, value, width) {
  const amount = brl(value);
  return padRight(label, Math.max(1, width - amount.length)) + amount;
}

function wrapLine(text, width) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  if (raw.length <= width) return [raw];
  const out = [];
  let rest = raw;
  while (rest.length > width) {
    out.push(rest.slice(0, width));
    rest = rest.slice(width);
  }
  if (rest) out.push(rest);
  return out;
}

function pushLine(lines, styles, text, style = "normal") {
  lines.push(String(text ?? ""));
  styles.push(style);
}

function buildReservationReceipt(payload, receiptWidth) {
  const lines = [];
  const styles = [];
  const w = Math.max(16, Number(receiptWidth) || 32);
  const hotel = payload?.hotel || {};
  const guest = payload?.guest || {};
  const bill = payload?.bill || {};
  const roomSelection = Array.isArray(payload?.roomSelection)
    ? payload.roomSelection
    : [];
  const charges = Array.isArray(payload?.charges) ? payload.charges : [];
  const payments = Array.isArray(payload?.payments) ? payload.payments : [];
  const hotelName = String(hotel.name || payload?.hotelName || "StayDesck").trim();
  const hotelCnpj = formatCnpj(
    hotel.cnpjFormatted || hotel.cnpj || payload?.hotelCnpj,
  );

  pushLine(lines, styles, center(hotelName, w), "titleCenter");
  if (hotelCnpj) {
    pushLine(lines, styles, center(`CNPJ: ${hotelCnpj}`, w), "muted");
  }
  pushLine(lines, styles, "-".repeat(w));
  pushLine(lines, styles, center(`RESERVA ${payload.code || ""}`, w), "heading");
  pushLine(lines, styles, center(dateTimeBR(new Date().toISOString()), w), "muted");
  if (payload.statusLabel) {
    pushLine(lines, styles, center(String(payload.statusLabel), w));
  }

  pushLine(lines, styles, sectionHeader("HOSPEDE", w));
  for (const part of wrapLine(guest.name || "-", w)) {
    pushLine(lines, styles, part, "itemTitle");
  }
  if (guest.phone) pushLine(lines, styles, `Tel: ${guest.phone}`);
  if (guest.cpf) pushLine(lines, styles, `CPF: ${guest.cpf}`);
  if (guest.email) {
    for (const part of wrapLine(`Email: ${guest.email}`, w)) {
      pushLine(lines, styles, part);
    }
  }

  pushLine(lines, styles, sectionHeader("ESTADIA", w));
  pushLine(lines, styles, `Entrada: ${dateBR(payload.checkInDate)}`);
  pushLine(lines, styles, `Saida:   ${dateBR(payload.checkOutDate)}`);
  if (payload.checkedInAt) {
    pushLine(lines, styles, `Check-in: ${dateTimeBR(payload.checkedInAt)}`);
  }
  if (payload.checkedOutAt) {
    pushLine(lines, styles, `Check-out: ${dateTimeBR(payload.checkedOutAt)}`);
  }
  pushLine(
    lines,
    styles,
    `Hospedes: ${payload.guests ?? "-"} · ${payload.nights ?? payload.plannedNights ?? "-"} diarias`,
  );

  pushLine(lines, styles, sectionHeader("QUARTO", w));
  if (roomSelection.length > 0) {
    for (const entry of roomSelection) {
      const label = `Q${entry.roomNumber} ${entry.roomTypeName || ""}`.trim();
      pushLine(lines, styles, label, "itemTitle");
      pushLine(
        lines,
        styles,
        moneyRow(
          `  ${entry.guests || 1} hosp.`,
          entry.nightlyRate ?? 0,
          w,
        ),
        "itemDetail",
      );
    }
  } else if (payload.room?.number) {
    pushLine(
      lines,
      styles,
      `Quarto ${payload.room.number} — ${payload.roomType?.name || ""}`.trim(),
      "itemTitle",
    );
  } else {
    pushLine(
      lines,
      styles,
      `Tipo: ${payload.roomType?.name || "-"} (sem quarto)`,
      "itemTitle",
    );
  }

  const extras = charges.filter(
    (c) => String(c.type || "").toUpperCase() !== "ROOM",
  );
  if (extras.length > 0) {
    pushLine(lines, styles, sectionHeader("CONSUMO", w));
    for (const charge of extras) {
      const qty = Number(charge.quantity) || 1;
      const raw = String(charge.description || charge.type || "Item");
      const withQty = qty > 1 ? `${qty}x ${raw}` : raw;
      const maxLen = Math.max(8, w - 10);
      const desc =
        withQty.length > maxLen
          ? `${withQty.slice(0, Math.max(1, maxLen - 1))}…`
          : withQty;
      pushLine(lines, styles, moneyRow(desc, charge.amount, w));
    }
  }

  pushLine(lines, styles, sectionHeader("CONTA", w));
  if (bill.roomNights != null) {
    pushLine(lines, styles, moneyRow("Diarias", bill.roomNights, w));
  }
  if (Number(bill.consumption) > 0) {
    pushLine(lines, styles, moneyRow("Consumo", bill.consumption, w));
  }
  if (Number(bill.services) > 0) {
    pushLine(lines, styles, moneyRow("Servicos", bill.services, w));
  }
  if (Number(bill.discounts) > 0) {
    pushLine(lines, styles, moneyRow("Descontos", -Math.abs(bill.discounts), w));
  }
  pushLine(lines, styles, moneyRow("TOTAL", bill.total ?? payload.roomTotal ?? 0, w), "heading");
  pushLine(lines, styles, moneyRow("Pago", bill.paid ?? 0, w));
  pushLine(lines, styles, moneyRow("Saldo", bill.balance ?? 0, w), "itemTitle");

  const confirmedPayments = payments.filter(
    (p) => String(p.status || "").toUpperCase() === "CONFIRMED",
  );
  if (confirmedPayments.length > 0) {
    pushLine(lines, styles, sectionHeader("PAGAMENTOS", w));
    for (const payment of confirmedPayments) {
      const method = payment.methodLabel || payment.method || "Pagamento";
      pushLine(lines, styles, moneyRow(method, payment.amount, w));
    }
  }

  if (payload.notes) {
    pushLine(lines, styles, sectionHeader("OBS", w));
    for (const part of wrapLine(payload.notes, w)) {
      pushLine(lines, styles, part);
    }
  }

  pushLine(lines, styles, "-".repeat(w));
  pushLine(lines, styles, center("Obrigado pela preferencia!", w));
  pushLine(lines, styles, center("StayDesck", w), "muted");

  return { lines, styles };
}

async function printReservation(payload, printCfg = {}) {
  if (!payload || (!payload.id && !payload.code)) {
    throw new Error("Payload da reserva invalido.");
  }

  const env = loadPrintEnv(printCfg);
  const { lines, styles } = buildReservationReceipt(payload, env.receiptWidth);
  const code = payload.code || payload.id || "reserva";

  await printReceipt({
    lines,
    lineStyles: styles,
    documentName: `StayDesck Reserva ${code}`,
    filePrefix: `reserva_${code}`,
    printCfg,
  });
}

async function main() {
  const payload = parsePayload();
  if (!payload) {
    console.error("STAYDESCK_PRINT_JSON ausente ou invalido.");
    process.exit(1);
  }

  try {
    await printReservation(payload);
    console.log(`Reserva ${payload.code || payload.id} impressa.`);
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  buildReservationReceipt,
  printReservation,
};
