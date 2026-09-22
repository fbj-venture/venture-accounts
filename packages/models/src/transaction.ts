export type Transaction = {
  details: string;
  serviceFee: number;
  // ZAR, signed: positive for a credit, negative for a debit.
  amount: number;
  date: Date;
  balance: number;
  hash: string;
};
