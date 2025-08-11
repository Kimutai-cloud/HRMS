import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-[#1E88E5] text-white hover:bg-[#1565C0] focus:ring-[#1E88E5] shadow-sm hover:shadow-md',
    secondary: 'bg-[#26A69A] text-white hover:bg-[#1E88E5] focus:ring-[#26A69A] shadow-sm hover:shadow-md',
    success: 'bg-[#43A047] text-white hover:bg-[#388E3C] focus:ring-[#43A047] shadow-sm hover:shadow-md',
    warning: 'bg-[#FB8C00] text-white hover:bg-[#F57C00] focus:ring-[#FB8C00] shadow-sm hover:shadow-md',
    error: 'bg-[#E53935] text-white hover:bg-[#D32F2F] focus:ring-[#E53935] shadow-sm hover:shadow-md',
    outline: 'border-2 border-[#1E88E5] text-[#1E88E5] hover:bg-[#1E88E5] hover:text-white focus:ring-[#1E88E5]'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
