import React from 'react';

const InputField = React.forwardRef(({
  label,
  type = 'text',
  error,
  icon: Icon,
  placeholder,
  helperText,
  className = '',
  required = false,
  ...props
}, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative rounded-xl shadow-xs">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          className={`block w-full rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
            Icon ? 'pl-11' : 'pl-4'
          } pr-4 py-3 ${
            error
              ? 'border-rose-300 text-rose-900 placeholder-rose-300 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/30'
              : 'border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-violet-500/20 bg-white hover:border-slate-300'
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

InputField.displayName = 'InputField';
export default InputField;
