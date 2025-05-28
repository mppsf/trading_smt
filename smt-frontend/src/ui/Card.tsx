import React from 'react';
import { cn } from './EmptyState';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'bordered';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  className, 
  variant = 'default',
  padding = 'md',
  children,
  ...props 
}) => {
  const baseClasses = 'rounded-xl transition-all duration-300';
  
  const variants = {
    default: 'bg-gray-900 border border-gray-700 hover:border-blue-500',
    gradient: 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700',
    bordered: 'bg-gray-900/50 border-2 border-gray-600 backdrop-blur-sm'
  };
  
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div 
      className={cn(baseClasses, variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
};
