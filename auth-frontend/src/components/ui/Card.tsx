import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`
      relative
      max-w-lg
      bg-white/80
      backdrop-blur-xl
      border
      border-white/40
      rounded-2xl
      shadow-xl
      shadow-gray-200/50
      p-8
      transition-all
      duration-300
      ease-out
      hover:shadow-2xl
      hover:shadow-gray-300/60
      hover:-translate-y-2
      hover:bg-white/90
      hover:border-white/60
      hover:scale-[1.02]
      group
      ${className}
    `}>
      {/* Glass effect overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default Card;