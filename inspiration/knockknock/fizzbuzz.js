export function ScaryFizzBuzz(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`ScaryFizzBuzz needs a positive whole number, got ${n}`);
  }
  if (n % 15 === 0) return "BooScary";
  if (n % 3 === 0)  return "Boo";
  if (n % 5 === 0)  return "Scary";
  return String(n);
}