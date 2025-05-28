// src/ui/index.tsx
import React from 'react';

// Utility function
export const cn = (...classes: (string | undefined | null | false)[]) => 
  classes.filter(Boolean).join(" ");

// Card Component
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  className, 
  variant = 'default',
  padding = 'md',
  children,
  ...props 
}) => {
  const variants = {
    default: 'bg-gray-900 border border-gray-700 hover:border-blue-500',
    gradient: 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700'
  };
  
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div 
      className={cn('rounded-xl transition-all duration-300', variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  withDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  children, 
  size = 'md',
  withDot = false 
}) => {
  const statusStyles = {
    success: 'bg-green-900 text-green-400',
    warning: 'bg-yellow-900 text-yellow-400',
    error: 'bg-red-900 text-red-400',
    info: 'bg-blue-900 text-blue-400',
    neutral: 'bg-gray-800 text-gray-400'
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  return (
    <div className={cn(
      'flex items-center rounded-full font-medium',
      statusStyles[status],
      sizes[size]
    )}>
      {withDot && (
        <div className={cn(
          'w-2 h-2 rounded-full mr-2',
          status === 'success' && 'bg-green-400',
          status === 'warning' && 'bg-yellow-400',
          status === 'error' && 'bg-red-400',
          status === 'info' && 'bg-blue-400',
          status === 'neutral' && 'bg-gray-400'
        )} />
      )}
      {children}
    </div>
  );
};

// Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="text-center py-12">
    {icon && (
      <div className="flex justify-center mb-4 text-gray-500">{icon}</div>
    )}
    <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
    {description && (
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn(
      'animate-spin rounded-full border-2 border-gray-600 border-t-blue-400',
      sizes[size],
      className
    )} />
  );
};