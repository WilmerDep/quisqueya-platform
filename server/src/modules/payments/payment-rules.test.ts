import { describe, expect, it } from 'vitest';
import { applyPaymentToInstallments, reversePaymentFromInstallments, PaymentRuleInstallment } from './payment-rules.js';

const baseInstallments = (): PaymentRuleInstallment[] => [
  { id: 'i1', number: 1, expectedAmount: 100, paidAmount: 0, status: 'PENDIENTE' },
  { id: 'i2', number: 2, expectedAmount: 100, paidAmount: 0, status: 'PENDIENTE' },
  { id: 'i3', number: 3, expectedAmount: 100, paidAmount: 0, status: 'PENDIENTE' },
];

describe('payment installment rules', () => {
  it('applies a partial payment to the selected installment', () => {
    expect(applyPaymentToInstallments(baseInstallments(), 'i1', 40)).toEqual([
      { id: 'i1', paidAmount: 40, status: 'PARCIAL', fullyPaid: false },
    ]);
  });

  it('spills a payment across installments in order', () => {
    expect(applyPaymentToInstallments(baseInstallments(), 'i1', 250)).toEqual([
      { id: 'i1', paidAmount: 100, status: 'PAGADO', fullyPaid: true },
      { id: 'i2', paidAmount: 100, status: 'PAGADO', fullyPaid: true },
      { id: 'i3', paidAmount: 50, status: 'PARCIAL', fullyPaid: false },
    ]);
  });

  it('rejects overpayment beyond pending installments', () => {
    expect(() => applyPaymentToInstallments(baseInstallments(), 'i1', 350)).toThrow('Payment exceeds pending installments.');
  });

  it('reverses from latest touched installments first', () => {
    const paidInstallments: PaymentRuleInstallment[] = [
      { id: 'i1', number: 1, expectedAmount: 100, paidAmount: 100, status: 'PAGADO' },
      { id: 'i2', number: 2, expectedAmount: 100, paidAmount: 100, status: 'PAGADO' },
      { id: 'i3', number: 3, expectedAmount: 100, paidAmount: 50, status: 'PARCIAL' },
    ];

    expect(reversePaymentFromInstallments(paidInstallments, 'i1', 150)).toEqual([
      { id: 'i3', paidAmount: 0, status: 'PENDIENTE', fullyPaid: false },
      { id: 'i2', paidAmount: 0, status: 'PENDIENTE', fullyPaid: false },
    ]);
  });
});
