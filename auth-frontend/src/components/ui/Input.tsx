import React, { useState } from 'react';
import { Eye, EyeOff, type LucideProps } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ComponentType<LucideProps>;
  type?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  icon: Icon,
  type = 'text',
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-[#212121] mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Icon className="w-5 h-5 input-icon text-[#9E9E9E] transition-colors duration-200" />
          </div>
        )}
        <input
          type={inputType}
          className={`
            w-full px-4 py-3.5 border-2 rounded-xl transition-all duration-300
            focus:outline-none focus:ring-4 focus:ring-[#1E88E5]/10 focus:border-[#1E88E5]
            placeholder:text-[#9E9E9E] placeholder:font-medium
            text-[#212121] font-medium
            ${Icon ? 'pl-12' : ''}
            ${isPassword ? 'pr-14' : ''}
            ${error 
              ? 'border-[#E53935] ring-4 ring-[#E53935]/10 bg-red-50/50' 
              : 'border-[#E0E0E0] hover:border-[#1E88E5] bg-white/80 backdrop-blur-sm'
            }
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg
                     transition-all duration-200 hover:scale-110 active:scale-95
                     bg-white/80 backdrop-blur-sm border border-gray-200/50
                     hover:bg-[#1E88E5]/5 hover:border-[#1E88E5]/20
                     focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5 text-[#666666] hover:text-[#1E88E5] transition-colors duration-200" />
            ) : (
              <Eye className="w-5 h-5 text-[#666666] hover:text-[#1E88E5] transition-colors duration-200" />
            )}
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-center space-x-2 text-[#E53935] text-sm font-medium">
          <div className="w-2 h-2 bg-[#E53935] rounded-full animate-pulse"></div>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Input;