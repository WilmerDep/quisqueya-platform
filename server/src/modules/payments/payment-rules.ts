export type InstallmentPaymentStatus = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';

export interface PaymentRuleInstallment {
  id: string;
  number: number;
  expectedAmount: number;
  paidAmount: number;
  status: InstallmentPaymentStatus;
}

export interface PaymentRuleChange {
  id: string;
  paidAmount: number;
  status: InstallmentPaymentStatus;
  fullyPaid: boolean;
}

const roundMoney = (value: number) => Number(value.toFixed(2));

const statusForPaidAmount = (expectedAmount: number, paidAmount: number): InstallmentPaymentStatus => {
  if (paidAmount <= 0) return 'PENDIENTE';
  if (paidAmount >= expectedAmount) return 'PAGADO';
  return 'PARCIAL';
};

export const applyPaymentToInstallments = (
  installments: PaymentRuleInstallment[],
  selectedInstallmentId: string,
  amount: number,
) => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');

  const selected = installments.find(installment => installment.id === selectedInstallmentId);
  if (!selected) throw new Error('Selected installment was not found.');

  let remaining = roundMoney(amount);
  const changes: PaymentRuleChange[] = [];
  const payable = installments
    .filter(installment => installment.number >= selected.number && installment.status !== 'PAGADO')
    .sort((a, b) => a.number - b.number);

  for (const installment of payable) {
    if (remaining <= 0) break;
    const due = roundMoney(installment.expectedAmount - installment.paidAmount);
    if (due <= 0) continue;

    const applied = Math.min(remaining, due);
    const paidAmount = roundMoney(installment.paidAmount + applied);
    const status = statusForPaidAmount(installment.expectedAmount, paidAmount);
    changes.push({ id: installment.id, paidAmount, status, fullyPaid: status === 'PAGADO' });
    remaining = roundMoney(remaining - applied);
  }

  if (remaining > 0) throw new Error('Payment exceeds pending installments.');
  return changes;
};

export const reversePaymentFromInstallments = (
  installments: PaymentRuleInstallment[],
  selectedInstallmentId: string,
  amount: number,
) => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Reverse amount must be greater than zero.');

  const selected = installments.find(installment => installment.id === selectedInstallmentId);
  if (!selected) throw new Error('Selected installment was not found.');

  let remaining = roundMoney(amount);
  const changes: PaymentRuleChange[] = [];
  const reversible = installments
    .filter(installment => installment.number >= selected.number && installment.paidAmount > 0)
    .sort((a, b) => b.number - a.number);

  for (const installment of reversible) {
    if (remaining <= 0) break;
    const removed = Math.min(installment.paidAmount, remaining);
    const paidAmount = roundMoney(installment.paidAmount - removed);
    const status = statusForPaidAmount(installment.expectedAmount, paidAmount);
    changes.push({ id: installment.id, paidAmount, status, fullyPaid: status === 'PAGADO' });
    remaining = roundMoney(remaining - removed);
  }

  if (remaining > 0) throw new Error('Not enough applied payment to reverse.');
  return changes;
};
