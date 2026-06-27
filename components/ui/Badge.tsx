import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const normalizedStatus = status.trim().toUpperCase();
  let colorClass = 'border border-[#E5E7EB] bg-[#F8FAFC] text-[#475569]';
  let dotClass = 'bg-[#94A3B8]';

  switch (normalizedStatus) {
    case 'ACTIVO':
    case 'ACTIVOS':
    case 'SALDADO':
    case 'PAGADO':
      colorClass = 'border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]';
      dotClass = 'bg-[#22C55E]';
      break;
    case 'PENDIENTE':
    case 'PARCIAL':
    case 'EN SEGUIMIENTO':
      colorClass = 'border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]';
      dotClass = 'bg-[#F59E0B]';
      break;
    case 'MORA':
    case 'EN MORA':
    case 'VENCIDO':
    case 'ATRASADO':
    case 'ATRASADOS':
    case 'BLOQUEADO':
    case 'BLOQUEADOS':
    case 'NO PAGO':
      colorClass = 'border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]';
      dotClass = 'bg-[#EF4444]';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold leading-none ${colorClass} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
};
