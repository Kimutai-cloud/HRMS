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
        <label className="block text-sm font-medium text-[#212121]">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9E9E9E]">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          type={inputType}
          className={`
            w-full px-4 py-3 border rounded-lg transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#1E88E5] focus:border-transparent
            ${Icon ? 'pl-10' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${error 
              ? 'border-[#E53935] ring-1 ring-[#E53935] bg-red-50' 
              : 'border-[#9E9E9E] hover:border-[#1E88E5] bg-white'
            }
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9E9E9E] hover:text-[#212121] transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-center space-x-2 text-[#E53935] text-sm">
          <div className="w-1.5 h-1.5 bg-[#E53935] rounded-full"></div>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Input;
