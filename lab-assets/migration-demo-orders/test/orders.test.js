import test from "node:test";
import assert from "node:assert/strict";
import { calculateTotal, discountForOrder } from "../src/orders.js";

test("calculates an order total", () => {
  assert.equal(calculateTotal([{ price: 20, quantity: 3 }]), 60);
});

test("applies the training discount threshold", () => {
  assert.equal(discountForOrder(100), 0.1);
  assert.equal(discountForOrder(99), 0);
});
