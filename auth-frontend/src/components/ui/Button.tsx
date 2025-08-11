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
    disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
    relative overflow-hidden group
    text-white font-medium tracking-wide
  `;
  
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-[#1E88E5] to-[#1565C0] 
      hover:from-[#1565C0] hover:to-[#0D47A1] 
      focus:ring-[#1E88E5]/25 
      shadow-lg shadow-[#1E88E5]/25 
      hover:shadow-xl hover:shadow-[#1E88E5]/35
      text-white
      hover:-translate-y-1 hover:scale-[1.02]
    `,
    secondary: `
      bg-gradient-to-r from-[#26A69A] to-[#1E88E5] 
      hover:from-[#1E88E5] hover:to-[#1565C0] 
      focus:ring-[#26A69A]/25 
      shadow-lg shadow-[#26A69A]/25 
      hover:shadow-xl hover:shadow-[#26A69A]/35
      text-white
      hover:-translate-y-1 hover:scale-[1.02]
    `,
    success: `
      bg-gradient-to-r from-[#43A047] to-[#388E3C] 
      hover:from-[#388E3C] hover:to-[#2E7D32] 
      focus:ring-[#43A047]/25 
      shadow-lg shadow-[#43A047]/25 
      hover:shadow-xl hover:shadow-[#43A047]/35
      text-white
      hover:-translate-y-1 hover:scale-[1.02]
    `,
    warning: `
      bg-gradient-to-r from-[#FB8C00] to-[#F57C00] 
      hover:from-[#F57C00] hover:to-[#EF6C00] 
      focus:ring-[#FB8C00]/25 
      shadow-lg shadow-[#FB8C00]/25 
      hover:shadow-xl hover:shadow-[#FB8C00]/35
      text-white
      hover:-translate-y-1 hover:scale-[1.02]
    `,
    error: `
      bg-gradient-to-r from-[#E53935] to-[#D32F2F] 
      hover:from-[#D32F2F] hover:to-[#C62828] 
      focus:ring-[#E53935]/25 
      shadow-lg shadow-[#E53935]/25 
      hover:shadow-xl hover:shadow-[#E53935]/35
      text-white
      hover:-translate-y-1 hover:scale-[1.02]
    `,
    outline: `
      bg-white/90 backdrop-blur-sm border-2 border-[#1E88E5] 
      text-[#1E88E5] hover:bg-[#1E88E5] hover:text-white 
      focus:ring-[#1E88E5]/25 
      shadow-lg shadow-[#1E88E5]/10 
      hover:shadow-xl hover:shadow-[#1E88E5]/25
      hover:-translate-y-1 hover:scale-[1.02]
    `
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm min-h-[36px]',
    md: 'px-6 py-3 text-base min-h-[44px]',
    lg: 'px-8 py-4 text-lg min-h-[52px]'
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