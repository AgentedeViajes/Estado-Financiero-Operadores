export interface Reservation {
  id: string;
  operator: string;
  phNemo: string;
  localizador: string;
  siti: string;
  apellido: string;
  limitePago: string;
  agente: string;
  valorNeto: number;
  isPaid: boolean;
  createdAt: number;
}

export interface OperatorPayment {
  id: string;
  operator: string;
  amount: number;
  description: string;
  createdAt: number;
}

export const DEFAULT_OPERATORS = [
  "EURORUTAS",
  "W2M",
  "ACTION TRAVEL",
  "PAXIMUM",
  "RESTEL",
  "WELCOMEBEDS",
  "GALAXY",
  "RATEHAWK",
  "ITAPARICA"
];
