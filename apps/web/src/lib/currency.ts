const zarFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

// en-ZA formats as "R 1 234,56"; swap only the decimal comma for a point
// ("R 1 234.56") and keep the locale's space digit grouping.
export function formatZar(amount: number) {
  return zarFormatter
    .formatToParts(amount)
    .map((part) => (part.type === "decimal" ? "." : part.value))
    .join("");
}
