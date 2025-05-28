import React, { memo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { MarketData } from '../types';

interface PriceDisplayProps {
  data: MarketData;
}

export const PriceDisplay = memo<PriceDisplayProps>(({ data }) => {
  const isPositive = data.change_percent >= 0;
  const isSignificantChange = Math.abs(data.change_percent) > 1;

  return (
    <>
    </>
  );
});

PriceDisplay.displayName = 'PriceDisplay';
