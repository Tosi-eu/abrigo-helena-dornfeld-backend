export function computeExpiryStatus(expiryDate: Date) {
  const today = new Date();
  const diff = Math.ceil((expiryDate.getTime() - today.getTime()) / (86400000));

  if (diff < 0) return { status: "expired", message: `Vencido há ${Math.abs(diff)} dias` };
  if (diff <= 30) return { status: "critical", message: `Vencerá em ${diff} dias` };
  if (diff <= 60) return { status: "warning", message: `Vencerá em ${diff} dias` };
  return { status: "healthy", message: `Vencerá em ${diff} dias` };
}

export function computeQuantityStatus(quantity: number, minimumStock?: number) {
  if (minimumStock == null) {
    return { status: "high", message: `Quantidade: ${quantity}` };
  }

  const margin = minimumStock * 0.2;

  if (quantity > minimumStock * 2)
    return { status: "high", message: `Estoque saudável. Mínimo: ${minimumStock}` };
  if (quantity > minimumStock + margin)
    return { status: "medium", message: `Estoque médio. Mínimo: ${minimumStock}` };
  return { status: "low", message: `Estoque baixo. Mínimo: ${minimumStock}` };
}