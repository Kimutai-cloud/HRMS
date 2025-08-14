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
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
          </div>
        )}
        <input
          type={inputType}
          className={`
            w-full px-4 py-3 border-2 rounded-xl transition-all duration-300
            focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500
            placeholder:text-gray-400 placeholder:font-medium
            text-gray-900 font-medium
            ${Icon ? 'pl-12' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${error 
              ? 'border-red-500 ring-4 ring-red-500/20 bg-red-50/50' 
              : 'border-gray-200 hover:border-blue-300 bg-white/80 backdrop-blur-sm hover:bg-white'
            }
            hover:shadow-md focus:shadow-lg
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg
                     transition-all duration-200 hover:scale-110 active:scale-95
                     bg-white/80 backdrop-blur-sm border border-gray-200/50
                     hover:bg-blue-50 hover:border-blue-300/50
                     focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4 text-gray-500 hover:text-blue-600 transition-colors duration-200" />
            ) : (
              <Eye className="w-4 h-4 text-gray-500 hover:text-blue-600 transition-colors duration-200" />
            )}
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm font-medium animate-pulse">
          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Input;