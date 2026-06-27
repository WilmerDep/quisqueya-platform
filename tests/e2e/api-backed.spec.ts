import { APIRequestContext, expect, test } from '@playwright/test';

const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';
const TEST_PASSWORD = 'Temp12345';

type ApiEnvelope<T> = { data: T };

type ApiUser = {
  id: string;
  username: string;
  role: string;
  branchId: string;
  isActive: boolean;
  createdAt?: string;
};

type ApiClient = {
  id: string;
  firstName: string;
  lastName: string;
  cedula: string;
  status: string;
  branchId: string;
  assignedUserId: string;
};

type ApiInstallment = {
  id: string;
  number: number;
  expectedAmount: number;
  paidAmount: number;
  status: string;
};

type ApiLoan = {
  id: string;
  clientId: string;
  balance: number;
  totalToPay: number;
  status: string;
  installments: ApiInstallment[];
};

type ApiPayment = {
  id: string;
  loanId: string;
  installmentId: string;
  amount: number;
  moraPaid: number;
};

type ApiCashMovement = {
  amount: number;
  note: string;
  type: string;
  category: string;
};

type ApiRoute = {
  id: string;
  status: string;
  items: Array<{
    id: string;
    visitStatus: string;
    visitResult?: string;
  }>;
};

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const expectOk = async <T>(response: Awaited<ReturnType<APIRequestContext['get']>>) => {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<ApiEnvelope<T>>;
};

const expectStatus = async (response: Awaited<ReturnType<APIRequestContext['get']>>, status: number) => {
  expect(response.status(), await response.text()).toBe(status);
};

const login = async (request: APIRequestContext, username: string, password: string) => {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password },
  });
  const payload = await expectOk<{ accessToken: string; user: ApiUser }>(response);
  return { token: payload.data.accessToken, user: payload.data.user };
};

const listUsers = async (request: APIRequestContext, token: string) => {
  const response = await request.get(`${API_BASE_URL}/users`, { headers: authHeaders(token) });
  return (await expectOk<ApiUser[]>(response)).data;
};

const ensureUser = async (
  request: APIRequestContext,
  token: string,
  payload: { username: string; name: string; role: string; branchId: string },
) => {
  const existing = (await listUsers(request, token)).find(user => user.username === payload.username);
  if (existing) return existing;

  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: authHeaders(token),
    data: { ...payload, password: TEST_PASSWORD },
  });
  return (await expectOk<ApiUser>(response)).data;
};

const createApprovedClient = async (
  request: APIRequestContext,
  token: string,
  stamp: string,
  assignedUserId: string,
) => {
  const created = await request.post(`${API_BASE_URL}/clients`, {
    headers: authHeaders(token),
    data: {
      firstName: `API_E2E_${stamp}`,
      lastName: 'Cliente',
      cedula: `E2E${stamp}`,
      phone: '809-555-4400',
      address: 'Validacion e2e API, Santo Domingo',
      branchId: 'MAIN',
      assignedUserId,
    },
  });
  const client = (await expectOk<ApiClient>(created)).data;

  const approved = await request.patch(`${API_BASE_URL}/clients/${client.id}`, {
    headers: authHeaders(token),
    data: { status: 'Aprobado' },
  });
  return (await expectOk<ApiClient>(approved)).data;
};

const createLoan = async (request: APIRequestContext, token: string, clientId: string) => {
  const response = await request.post(`${API_BASE_URL}/loans`, {
    headers: authHeaders(token),
    data: {
      clientId,
      amount: 3000,
      interestRate: 10,
      duration: 3,
      frequency: 'Semanal',
      startDate: '2026-05-11',
    },
  });
  return (await expectOk<ApiLoan>(response)).data;
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'API-backed tests run once in the chromium project.');
});

test.describe('API-backed payments, routes, and permissions', () => {
  test('payments update installments, balance, cash, audit, and reject invalid operations', async ({ request }) => {
    const { token } = await login(request, 'admin', 'admin123');
    const collector = await ensureUser(request, token, {
      username: 'api_e2e_collector',
      name: 'API E2E Collector',
      role: 'Cobrador',
      branchId: 'MAIN',
    });
    const stamp = Date.now().toString();
    const client = await createApprovedClient(request, token, stamp, collector.id);
    const loan = await createLoan(request, token, client.id);
    const installment = loan.installments[0];

    const paymentResponse = await request.post(`${API_BASE_URL}/payments`, {
      headers: authHeaders(token),
      data: {
        loanId: loan.id,
        installmentId: installment.id,
        amount: 500,
        moraPaid: 25,
      },
    });
    const payment = (await expectOk<ApiPayment>(paymentResponse)).data;
    expect(payment.amount).toBe(500);
    expect(payment.moraPaid).toBe(25);

    const loansAfterPayment = await request.get(`${API_BASE_URL}/loans`, { headers: authHeaders(token) });
    const paidLoan = (await expectOk<ApiLoan[]>(loansAfterPayment)).data.find(item => item.id === loan.id);
    expect(paidLoan?.balance).toBe(2800);
    expect(paidLoan?.installments[0].paidAmount).toBe(500);
    expect(paidLoan?.installments[0].status).toBe('PARCIAL');

    const cashAfterPayment = await request.get(`${API_BASE_URL}/cash-movements`, { headers: authHeaders(token) });
    const paymentCash = (await expectOk<ApiCashMovement[]>(cashAfterPayment)).data.find(item => item.note === `Cobro ${payment.id}`);
    expect(paymentCash?.type).toBe('IN');
    expect(paymentCash?.category).toBe('COBRO');
    expect(paymentCash?.amount).toBe(525);

    const overpayment = await request.post(`${API_BASE_URL}/payments`, {
      headers: authHeaders(token),
      data: {
        loanId: loan.id,
        installmentId: installment.id,
        amount: 999999,
      },
    });
    await expectStatus(overpayment, 400);

    const voidResponse = await request.post(`${API_BASE_URL}/payments/${payment.id}/void`, {
      headers: authHeaders(token),
      data: { reason: 'API e2e reversal' },
    });
    await expectOk<{ paymentId: string }>(voidResponse);

    const loansAfterVoid = await request.get(`${API_BASE_URL}/loans`, { headers: authHeaders(token) });
    const voidedLoan = (await expectOk<ApiLoan[]>(loansAfterVoid)).data.find(item => item.id === loan.id);
    expect(voidedLoan?.balance).toBe(3300);
    expect(voidedLoan?.installments[0].paidAmount).toBe(0);
    expect(voidedLoan?.installments[0].status).toBe('PENDIENTE');

    const listedPayments = await request.get(`${API_BASE_URL}/payments`, { headers: authHeaders(token) });
    expect((await expectOk<ApiPayment[]>(listedPayments)).data.find(item => item.id === payment.id)).toBeUndefined();

    const duplicateVoid = await request.post(`${API_BASE_URL}/payments/${payment.id}/void`, {
      headers: authHeaders(token),
      data: { reason: 'duplicate reversal' },
    });
    await expectStatus(duplicateVoid, 400);

    const audit = await request.get(`${API_BASE_URL}/audit-logs?search=${payment.id}`, { headers: authHeaders(token) });
    const auditActions = (await expectOk<Array<{ action: string }>>(audit)).data.map(item => item.action);
    expect(auditActions).toContain('PAYMENT_CREATED');
    expect(auditActions).toContain('PAYMENT_VOIDED');
  });

  test('routes close through settlement, create cash movement, and reject duplicate close', async ({ request }) => {
    const { token } = await login(request, 'admin', 'admin123');
    const collector = await ensureUser(request, token, {
      username: 'api_e2e_route_collector',
      name: 'API E2E Route Collector',
      role: 'Cobrador',
      branchId: 'MAIN',
    });
    const stamp = `${Date.now()}R`;
    const client = await createApprovedClient(request, token, stamp, collector.id);
    const loan = await createLoan(request, token, client.id);
    const installment = loan.installments[0];
    const itemId = `api-e2e-route-item-${stamp}`;

    const created = await request.post(`${API_BASE_URL}/routes`, {
      headers: authHeaders(token),
      data: {
        collectorId: collector.id,
        branchId: 'MAIN',
        date: '2026-05-11',
        items: [{
          id: itemId,
          loanId: loan.id,
          installmentId: installment.id,
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          address: 'Validacion e2e API, Santo Domingo',
          amountToCollect: installment.expectedAmount,
          order: 1,
        }],
      },
    });
    const route = (await expectOk<ApiRoute>(created)).data;
    expect(route.status).toBe('Abierta');
    expect(route.items).toHaveLength(1);

    const started = await request.patch(`${API_BASE_URL}/routes/${route.id}/status`, {
      headers: authHeaders(token),
      data: { status: 'En Curso' },
    });
    expect((await expectOk<ApiRoute>(started)).data.status).toBe('En Curso');

    const item = await request.patch(`${API_BASE_URL}/routes/${route.id}/items/${itemId}`, {
      headers: authHeaders(token),
      data: { visitStatus: 'VISITED', visitResult: 'PROMESA', notes: 'API e2e route update' },
    });
    expect((await expectOk<ApiRoute['items'][number]>(item)).data.visitStatus).toBe('VISITED');

    const directClose = await request.patch(`${API_BASE_URL}/routes/${route.id}/status`, {
      headers: authHeaders(token),
      data: { status: 'Cerrada' },
    });
    await expectStatus(directClose, 400);

    const closed = await request.post(`${API_BASE_URL}/routes/${route.id}/close`, {
      headers: authHeaders(token),
      data: { cashInHand: 123 },
    });
    expect((await expectOk<ApiRoute>(closed)).data.status).toBe('Cerrada');

    const cash = await request.get(`${API_BASE_URL}/cash-movements`, { headers: authHeaders(token) });
    const routeCash = (await expectOk<ApiCashMovement[]>(cash)).data.find(item => item.note === `Liquidacion de ruta ${route.id}`);
    expect(routeCash?.type).toBe('IN');
    expect(routeCash?.category).toBe('COBRO');
    expect(routeCash?.amount).toBe(123);

    const duplicateClose = await request.post(`${API_BASE_URL}/routes/${route.id}/close`, {
      headers: authHeaders(token),
      data: { cashInHand: 123 },
    });
    await expectStatus(duplicateClose, 400);

    const audit = await request.get(`${API_BASE_URL}/audit-logs?search=${route.id}`, { headers: authHeaders(token) });
    const auditActions = (await expectOk<Array<{ action: string }>>(audit)).data.map(item => item.action);
    expect(auditActions).toContain('ROUTE_CREATED');
    expect(auditActions).toContain('ROUTE_STATUS_UPDATED');
    expect(auditActions).toContain('ROUTE_CLOSED');
  });

  test('role permissions protect company, branch, route, and payment boundaries', async ({ request }) => {
    const { token: adminToken } = await login(request, 'admin', 'admin123');
    const { token: masterToken } = await login(request, 'master', 'master123');

    const masterCompanies = await request.get(`${API_BASE_URL}/companies`, { headers: authHeaders(masterToken) });
    expect((await expectOk<unknown[]>(masterCompanies)).data.length).toBeGreaterThan(1);

    const adminCreateCompany = await request.post(`${API_BASE_URL}/companies`, {
      headers: authHeaders(adminToken),
      data: { name: 'Should Not Exist', planId: 'p1', adminUsername: `blocked_${Date.now()}` },
    });
    await expectStatus(adminCreateCompany, 403);

    const adminCreateSuper = await request.post(`${API_BASE_URL}/users`, {
      headers: authHeaders(adminToken),
      data: {
        name: 'Blocked Super Admin',
        username: `blocked_super_${Date.now()}`,
        role: 'Super Admin',
        branchId: 'MAIN',
        password: TEST_PASSWORD,
      },
    });
    await expectStatus(adminCreateSuper, 400);

    const supervisor = await ensureUser(request, adminToken, {
      username: 'api_e2e_supervisor',
      name: 'API E2E Supervisor',
      role: 'Supervisor',
      branchId: 'MAIN',
    });
    const { token: supervisorToken } = await login(request, supervisor.username, TEST_PASSWORD);

    const supervisorUsers = await request.get(`${API_BASE_URL}/users`, { headers: authHeaders(supervisorToken) });
    expect(new Set((await expectOk<ApiUser[]>(supervisorUsers)).data.map(user => user.branchId))).toEqual(new Set(['MAIN']));

    const supervisorCreateSupervisor = await request.post(`${API_BASE_URL}/users`, {
      headers: authHeaders(supervisorToken),
      data: {
        name: 'Blocked Supervisor Child',
        username: `blocked_sup_${Date.now()}`,
        role: 'Supervisor',
        branchId: 'MAIN',
        password: TEST_PASSWORD,
      },
    });
    await expectStatus(supervisorCreateSupervisor, 400);

    const supervisorCreateOtherBranchCollector = await request.post(`${API_BASE_URL}/users`, {
      headers: authHeaders(supervisorToken),
      data: {
        name: 'Blocked Other Branch Collector',
        username: `blocked_cob_${Date.now()}`,
        role: 'Cobrador',
        branchId: 'B-01689389-f73e-4189-b1a4-8319e204d07d',
        password: TEST_PASSWORD,
      },
    });
    await expectStatus(supervisorCreateOtherBranchCollector, 400);

    const assignedCollector = await ensureUser(request, adminToken, {
      username: 'api_e2e_assigned_collector',
      name: 'API E2E Assigned Collector',
      role: 'Cobrador',
      branchId: 'MAIN',
    });
    const unassignedCollector = await ensureUser(request, adminToken, {
      username: 'api_e2e_unassigned_collector',
      name: 'API E2E Unassigned Collector',
      role: 'Cobrador',
      branchId: 'MAIN',
    });
    const { token: unassignedCollectorToken } = await login(request, unassignedCollector.username, TEST_PASSWORD);

    const client = await createApprovedClient(request, adminToken, `${Date.now()}P`, assignedCollector.id);
    const loan = await createLoan(request, adminToken, client.id);

    const collectorCreateClient = await request.post(`${API_BASE_URL}/clients`, {
      headers: authHeaders(unassignedCollectorToken),
      data: {
        firstName: 'Blocked',
        lastName: 'Client',
        cedula: `BLOCK${Date.now()}`,
        phone: '809-555-4500',
        address: 'Blocked',
        branchId: 'MAIN',
        assignedUserId: unassignedCollector.id,
      },
    });
    await expectStatus(collectorCreateClient, 403);

    const collectorCreateRoute = await request.post(`${API_BASE_URL}/routes`, {
      headers: authHeaders(unassignedCollectorToken),
      data: {
        collectorId: unassignedCollector.id,
        branchId: 'MAIN',
        date: '2026-05-11',
        items: [{
          loanId: loan.id,
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          address: 'Blocked',
          amountToCollect: 1,
          order: 1,
        }],
      },
    });
    await expectStatus(collectorCreateRoute, 403);

    const unassignedPayment = await request.post(`${API_BASE_URL}/payments`, {
      headers: authHeaders(unassignedCollectorToken),
      data: {
        loanId: loan.id,
        installmentId: loan.installments[0].id,
        amount: 100,
      },
    });
    await expectStatus(unassignedPayment, 400);
  });
});
