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
