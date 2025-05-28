import { cn } from "./EmptyState";

interface StatusBadgeProps {
    status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
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
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-2 text-base'
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
  
 