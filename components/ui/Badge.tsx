import React from 'react';

interface BadgeProps {
  status: string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  let colorClass = 'bg-gray-100 text-gray-800';

  switch (status.toUpperCase()) {
    case 'ACTIVO':
    case 'PENDIENTE':
      colorClass = 'bg-blue-100 text-blue-800';
      break;
    case 'SALDADO':
    case 'PAGADO':
      colorClass = 'bg-green-100 text-green-800';
      break;
    case 'MORA':
    case 'VENCIDO':
      colorClass = 'bg-red-100 text-red-800';
      break;
    case 'PARCIAL':
      colorClass = 'bg-yellow-100 text-yellow-800';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
};