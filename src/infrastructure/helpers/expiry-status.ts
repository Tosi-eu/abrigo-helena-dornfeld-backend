export function computeExpiryStatus(expiryDate: Date) {
  const today = new Date();
  const diff = Math.ceil(
    (new Date(expiryDate).getTime() - today.getTime()) / 86400000,
  );

  if (diff < 0)
    return { status: 'expired', message: `Vencido há ${Math.abs(diff)} dias` };
  if (diff <= 30)
    return { status: 'critical', message: `Vencerá em ${diff} dias` };
  if (diff <= 45)
    return { status: 'warning', message: `Vencerá em ${diff} dias` };
  return { status: 'healthy', message: `Vencerá em ${diff} dias` };
}

export function computeQuantityStatus(quantity: number, minimumStock: number) {
  const lowMax = minimumStock * 1.35;
  const highThreshold = minimumStock * 3;

  if (quantity >= highThreshold) {
    return {
      status: 'high',
      message: `Estoque saudável. Mínimo: ${minimumStock}`,
    };
  }

  if (quantity >= minimumStock && quantity <= lowMax) {
    return { status: 'low', message: `Estoque baixo. Mínimo: ${minimumStock}` };
  }

  if (quantity > lowMax && quantity < highThreshold) {
    return {
      status: 'medium',
      message: `Estoque médio. Mínimo: ${minimumStock}`,
    };
  }

  return {
    status: 'critical',
    message: `Estoque crítico. Mínimo: ${minimumStock}`,
  };
}
