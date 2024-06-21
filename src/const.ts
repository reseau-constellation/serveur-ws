export const PRÉFIX_MACHINE = "MESSAGE MACHINE :";

export type MessageBinaire =
  | MessageLançageNœud
  | MessageNœudPrêt
  | MessageOnFerme
  | MessageNœudFermé;

export type MessageLançageNœud = {
  type: "LANÇAGE NŒUD";
};

export type MessageNœudPrêt = {
  type: "NŒUD PRÊT";
  port: number;
  codeSecret: string;
};

export type MessageOnFerme = {
  type: "ON FERME";
};

export type MessageNœudFermé = {
  type: "NŒUD FERMÉ";
};
