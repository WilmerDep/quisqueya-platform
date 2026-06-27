import { describe, expect, it } from 'vitest';
import { Frequency } from './types';
import { canCreateResource, createCompany, createUser } from './services/dataService';
import { generateSchedule } from './utils';

const clearStorage = () => {
  localStorage.clear();
};

describe('generateSchedule', () => {
  it('generates rounded installments that add up to principal plus flat interest', () => {
    const schedule = generateSchedule(10_000, 20, 3, Frequency.SEMANAL, '2026-05-08');

    expect(schedule).toHaveLength(3);
    expect(schedule.reduce((sum, installment) => sum + installment.expectedAmount, 0)).toBe(12_000);
    expect(schedule[0].dueDate).toContain('2026-05-15');
  });
});

describe('plan limits', () => {
  it('blocks users beyond the selected plan limit', () => {
    clearStorage();
    const creator = { id: 'M1', name: 'Master' } as any;
    const result = createCompany({ name: 'Plan Basico Test', planId: 'p1', billingCycle: 'MONTHLY' }, creator);
    const admin = result.adminUser;

    createUser({ name: 'Uno', username: 'uno', branchId: admin.branchId }, admin.id);
    createUser({ name: 'Dos', username: 'dos', branchId: admin.branchId }, admin.id);

    expect(canCreateResource(admin.companyId, 'USER')).toBe(false);
  });
});
