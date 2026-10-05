/**
 * Utility for Indian Rupee (INR / ₹) Currency Formatting.
 * Standard Indian numbering system formatting:
 * Example: 250000 -> ₹2,50,000.00
 */

export const formatINR = (amount, fallback = '₹0.00') => {
  if (amount === undefined || amount === null || amount === '') return fallback;
  const num = Number(amount);
  if (isNaN(num)) return fallback;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default formatINR;
