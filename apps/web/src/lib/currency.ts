const zarFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

export function formatZar(amount: number) {
  return zarFormatter.format(amount);
}
