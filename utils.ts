import { Frequency, Installment } from './types';

// Formato de moneda RD$
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2
  }).format(amount);
};

// Formato de fecha RD (DD/MM/YYYY)
export const formatDate = (dateString: string): string => {
  if (!dateString) return '---';
  const parts = dateString.split(/[-/T]/);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const getNextDueDate = (currentDate: Date, frequency: Frequency): Date => {
  const nextDate = new Date(currentDate);
  switch (frequency) {
    case Frequency.DIARIO:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case Frequency.SEMANAL:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case Frequency.QUINCENAL:
      nextDate.setDate(nextDate.getDate() + 15);
      break;
    case Frequency.MENSUAL:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  return nextDate;
};

// Generador de cuotas (Sistema Flat/Redito común en RD)
export const generateSchedule = (
  amount: number,
  interestRate: number, 
  duration: number,
  frequency: Frequency,
  startDateStr: string
): Installment[] => {
  const safeAmount = Number(amount) || 0;
  const safeInterestRate = Number(interestRate) || 0;
  const safeDuration = Math.max(1, Number(duration) || 1);
  const totalInterest = safeAmount * (safeInterestRate / 100);
  const totalToPay = safeAmount + totalInterest;
  const amountPerQuota = Math.floor((totalToPay / safeDuration) * 100) / 100;
  
  const schedule: Installment[] = [];
  const parts = startDateStr.split(/[-/T]/);
  let currentDate = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
  let accumulated = 0;

  for (let i = 1; i <= safeDuration; i++) {
    currentDate = getNextDueDate(currentDate, frequency);
    const quotaAmount = i === safeDuration
      ? Number((totalToPay - accumulated).toFixed(2))
      : Number(amountPerQuota.toFixed(2));
    if (i !== safeDuration) accumulated += quotaAmount;
    schedule.push({
      id: crypto.randomUUID(),
      loanId: '', 
      number: i,
      dueDate: currentDate.toISOString(),
      expectedAmount: quotaAmount,
      paidAmount: 0,
      status: 'PENDIENTE'
    });
  }
  return schedule;
};

// Generador de mensaje para un NUEVO PRÉSTAMO con GLOSARIO Y MORA
export const generateNewLoanMessage = (
  client: any,
  loan: any
): string => {
  const quotaAmount = loan.installments[0]?.expectedAmount || 0;
  
  // Generar Glosario de Cuotas
  const scheduleList = loan.installments.map((inst: any) => 
    `• Cuota ${inst.number}: ${formatDate(inst.dueDate)} - ${formatCurrency(inst.expectedAmount)}`
  ).join('\n');

  return `*🚀 PRÉSTAMO APROBADO - PRESTAFÁCIL RD*\n\n` +
    `Hola *${client.firstName}*, adjunto los detalles de su desembolso:\n\n` +
    `*💰 CAPITAL:* ${formatCurrency(loan.amount)}\n` +
    `*🗓️ PLAN:* ${loan.duration} pagos ${loan.frequency.toLowerCase()}s\n` +
    `*💵 CUOTA:* ${formatCurrency(quotaAmount)}\n` +
    `*📊 TOTAL A PAGAR:* ${formatCurrency(loan.totalToPay)}\n\n` +
    `*📅 CALENDARIO DE PAGOS:*\n` +
    `${scheduleList}\n\n` +
    `*⚠️ POLÍTICA DE MORA:*\n` +
    `Los pagos después de la fecha límite generarán cargos adicionales por mora. Evite cargos extras pagando a tiempo.\n\n` +
    `_Este mensaje sirve como comprobante digital._`;
};

export const generateWhatsAppLink = (
  phone: string,
  clientName: string,
  amount: number,
  loanNumber: string,
  balance: number,
  date: string
): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  const text = `*🧾 RECIBO DE PAGO - PRESTAFÁCIL*\n\n` +
    `Hola ${clientName}, hemos recibido su pago correctamente.\n\n` +
    `*💰 Monto:* ${formatCurrency(amount)}\n` +
    `*📅 Fecha:* ${formatDate(date)}\n` +
    `*🔢 Préstamo:* #${loanNumber.slice(0,4)}\n` +
    `*📉 Balance Pendiente:* ${formatCurrency(balance)}\n\n` +
    `_Gracias por su pago puntual._`;
  return `https://wa.me/1${cleanPhone}?text=${encodeURIComponent(text)}`;
};

export const generateClientStatusMessage = (
  client: any,
  metrics: any
): string => {
  const statusIcon = metrics.overdueCount > 0 ? '🔴' : '🟢';
  const statusText = metrics.overdueCount > 0 ? 'TIENE ATRASOS' : 'AL DÍA';
  const nextPay = metrics.nextPayment ? formatDate(metrics.nextPayment.dueDate) : 'No pendiente';
  const amount = metrics.nextPayment ? formatCurrency(metrics.nextPayment.expectedAmount) : 'RD$ 0.00';
  
  return `*📊 ESTADO DE CUENTA - PRESTAFÁCIL RD*\n\n` +
    `*Cliente:* ${client.firstName} ${client.lastName}\n` +
    `*Estatus:* ${statusIcon} ${statusText}\n` +
    `*Próximo Pago:* ${nextPay}\n` +
    `*Monto:* ${amount}\n` +
    `*Cuotas en Mora:* ${metrics.overdueCount}\n` +
    `*Puntualidad:* ${metrics.punctuality}%\n\n` +
    `_Para más detalles contacte a su oficial de cobro._`;
};
