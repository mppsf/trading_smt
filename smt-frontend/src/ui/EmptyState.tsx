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
    action
  }) => (
    <div className="text-center py-12">
      {icon && (
        <div className="flex justify-center mb-4 text-gray-500">
          {icon}
        </div>
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
  
  export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
  }