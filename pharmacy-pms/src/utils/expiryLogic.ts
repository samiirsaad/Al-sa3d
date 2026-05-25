export const getExpiryUrgency = (expiryDate: string): 'red' | 'orange' | 'yellow' | 'green' => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'red';
  if (diffDays <= 14) return 'orange';
  if (diffDays <= 30) return 'yellow';
  return 'green';
};

export const isExpired = (expiryDate: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return expiryDate < today;
};

export const isExpiringSoon = (expiryDate: string, days = 30): boolean => {
  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + days);
  
  const expiry = new Date(expiryDate);
  return expiry <= future && expiry >= today;
};

export const getUrgencyColor = (urgency: 'red' | 'orange' | 'yellow' | 'green'): string => {
  switch (urgency) {
    case 'red': return 'bg-red-500';
    case 'orange': return 'bg-orange-500';
    case 'yellow': return 'bg-yellow-500';
    case 'green': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export const getUrgencyBadgeClass = (urgency: 'red' | 'orange' | 'yellow' | 'green'): string => {
  switch (urgency) {
    case 'red': return 'bg-red-100 text-red-800';
    case 'orange': return 'bg-orange-100 text-orange-800';
    case 'yellow': return 'bg-yellow-100 text-yellow-800';
    case 'green': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
