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
  const date = new Date(dateString);
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
  interestRate: number, // Entero, ej: 10, 15, 20
  duration: number,
  frequency: Frequency,
  startDateStr: string
): Installment[] => {
  const totalInterest = amount * (interestRate / 100);
  const totalToPay = amount + totalInterest;
  const amountPerQuota = Math.ceil(totalToPay / duration); // Redondeo hacia arriba para asegurar cobro
  
  const schedule: Installment[] = [];
  let currentDate = new Date(startDateStr);

  for (let i = 1; i <= duration; i++) {
    currentDate = getNextDueDate(currentDate, frequency);
    
    // Ajuste de centavos en la última cuota si es necesario
    let quotaAmount = amountPerQuota;
    if (i === duration) {
       const accumulated = amountPerQuota * (duration - 1);
       quotaAmount = totalToPay - accumulated;
    }

    schedule.push({
      id: crypto.randomUUID(),
      loanId: '', // Se asigna al guardar
      number: i,
      dueDate: currentDate.toISOString(),
      expectedAmount: quotaAmount,
      paidAmount: 0,
      status: 'PENDIENTE'
    });
  }

  return schedule;
};

// Generador de Recibo para WhatsApp
export const generateWhatsAppLink = (
  phone: string,
  clientName: string,
  amount: number,
  loanNumber: string,
  balance: number,
  date: string
): string => {
  // Limpiar teléfono (solo números)
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Construir mensaje
  const text = `*🧾 RECIBO DE PAGO - PRESTAFÁCIL*\n\n` +
    `Hola ${clientName}, hemos recibido su pago correctamente.\n\n` +
    `*💰 Monto:* ${formatCurrency(amount)}\n` +
    `*📅 Fecha:* ${formatDate(date)}\n` +
    `*🔢 Préstamo:* #${loanNumber.slice(0,4)}\n` +
    `*📉 Balance Pendiente:* ${formatCurrency(balance)}\n\n` +
    `_Gracias por su pago puntual._`;

  return `https://wa.me/1${cleanPhone}?text=${encodeURIComponent(text)}`;
};