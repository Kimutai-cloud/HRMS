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
  const baseClasses = `
    inline-flex items-center justify-center font-semibold rounded-xl 
    transition-all duration-300 focus:outline-none focus:ring-4 
    disabled:opacity-60 disabled:cursor-not-allowed
    relative overflow-hidden group
    text-white font-medium shadow-lg
    hover:shadow-xl hover:-translate-y-1 hover:scale-105
  `;
  
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-blue-600 to-blue-700 
      hover:from-blue-700 hover:to-blue-800 
      focus:ring-blue-500/30
      shadow-blue-500/25
      hover:shadow-blue-600/40
    `,
    secondary: `
      bg-gradient-to-r from-teal-600 to-teal-700 
      hover:from-teal-700 hover:to-teal-800 
      focus:ring-teal-500/30
      shadow-teal-500/25
      hover:shadow-teal-600/40
    `,
    success: `
      bg-gradient-to-r from-green-600 to-green-700 
      hover:from-green-700 hover:to-green-800 
      focus:ring-green-500/30
      shadow-green-500/25
      hover:shadow-green-600/40
    `,
    warning: `
      bg-gradient-to-r from-orange-600 to-orange-700 
      hover:from-orange-700 hover:to-orange-800 
      focus:ring-orange-500/30
      shadow-orange-500/25
      hover:shadow-orange-600/40
    `,
    error: `
      bg-gradient-to-r from-red-600 to-red-700 
      hover:from-red-700 hover:to-red-800 
      focus:ring-red-500/30
      shadow-red-500/25
      hover:shadow-red-600/40
    `,
    outline: `
      bg-white/90 backdrop-blur-sm border-2 border-blue-600 
      text-blue-600 hover:bg-blue-600 hover:text-white 
      focus:ring-blue-500/30
      shadow-blue-500/10
      hover:shadow-blue-600/25
    `
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center space-x-2">
        {loading && (
          <Loader2 className="w-5 h-5 animate-spin" />
        )}
        <span className="font-semibold">{children}</span>
      </div>
    </button>
  );
};

export default Button;