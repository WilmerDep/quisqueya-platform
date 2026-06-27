import React from 'react';
import { Client } from '../../types';

type ClientAvatarProps = {
  client?: Pick<Client, 'firstName' | 'lastName' | 'photo'> | null;
  className?: string;
  textClassName?: string;
  alt?: string;
};

const getClientInitial = (client?: Pick<Client, 'firstName' | 'lastName' | 'photo'> | null) => {
  if (!client) return 'C';
  return (client.firstName?.trim()?.[0] || client.lastName?.trim()?.[0] || 'C').toUpperCase();
};

export const ClientAvatar: React.FC<ClientAvatarProps> = ({
  client,
  className = '',
  textClassName = '',
  alt,
}) => (
  <div className={`flex items-center justify-center overflow-hidden bg-[#EFF6FF] text-[#2563EB] ${className}`.trim()}>
    {client?.photo ? (
      <img
        src={client.photo}
        alt={alt || `${client.firstName} ${client.lastName}`.trim() || 'Cliente'}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className={textClassName || 'font-black'}>{getClientInitial(client)}</span>
    )}
  </div>
);
