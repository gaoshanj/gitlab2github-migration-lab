export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function discountForOrder(total) {
  return total >= 100 ? 0.1 : 0;
}
