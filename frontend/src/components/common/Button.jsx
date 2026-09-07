import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled = false,
  onClick,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm';

  const variants = {
    primary: 'bg-violet-500 hover:bg-violet-600 text-white focus:ring-violet-400 hover:shadow-violet-300/40 hover:shadow-lg active:scale-[0.98]',
    secondary: 'bg-slate-800 hover:bg-slate-900 text-white focus:ring-slate-700 active:scale-[0.98]',
    outline: 'border border-violet-200 hover:border-violet-500 bg-white hover:bg-violet-50 text-violet-700 hover:text-violet-800 focus:ring-violet-400 active:scale-[0.98]',
    ghost: 'text-slate-600 hover:text-violet-600 hover:bg-violet-50 focus:ring-violet-400',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 active:scale-[0.98]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;
