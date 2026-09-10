import React from 'react';
import { HiCheck, HiOutlineCheckCircle } from 'react-icons/hi';
import { PASSWORD_REQUIREMENTS } from '../../utils/passwordValidation';

const PasswordRequirementsGuide = ({ password = '', className = '' }) => {
  return (
    <div className={`p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 ${className}`}>
      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <HiOutlineCheckCircle className="w-3.5 h-3.5 text-violet-600" />
        Password Requirements:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 text-xs">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const isMet = req.check(password);
          return (
            <div
              key={req.id}
              className={`flex items-center gap-1.5 text-[11px] transition-colors duration-150 ${
                isMet ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-normal'
              }`}
            >
              <span
                className={`flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                  isMet
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {isMet ? <HiCheck className="w-2.5 h-2.5 stroke-2" /> : '•'}
              </span>
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordRequirementsGuide;
