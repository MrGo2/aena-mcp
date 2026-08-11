// Flight status codes are identical across both AENA APIs.
export const STATUS_LABELS: Record<string, string> = {
  SCH: "Scheduled",
  INI: "Scheduled (gate pre-assigned)",
  HOR: "On time",
  RET: "Delayed",
  EMB: "Boarding",
  ULL: "Last call",
  NPT: "Gate changed",
  CER: "Gate closed",
  FLY: "In flight",
  FNL: "On approach",
  LND: "Landed",
  ATE: "Landed (confirmed)",
  OPE: "Baggage on belt",
  OPF: "Baggage on belt",
  IBK: "Baggage on belt",
  BOR: "Completed",
  CAN: "Cancelled",
  DES: "Diverted",
};

export const statusLabel = (code: string | undefined): string =>
  (code && STATUS_LABELS[code]) || code || "Unknown";
