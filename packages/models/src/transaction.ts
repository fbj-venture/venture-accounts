export type Transaction = {
  details: string;
  serviceFee: number;
  debits: number;
  credits: number;
  date: Date;
  balance: number;
  hash: string;
};
