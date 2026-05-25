import React from 'react';
import { ExpiryAlert } from '../types';
import { getUrgencyBadgeClass, formatDate } from '../utils/expiryLogic';

interface ExpiryBadgeProps {
  alert: ExpiryAlert;
}

export const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({ alert }) => {
  const badgeClass = getUrgencyBadgeClass(alert.urgency);

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
      <span>
        {alert.quantity} x {alert.drug_name}
      </span>
      <span className="ml-1">
        (Exp: {formatDate(alert.expiry_date)})
      </span>
    </div>
  );
};
