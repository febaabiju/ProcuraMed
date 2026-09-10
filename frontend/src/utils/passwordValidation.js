/**
 * Unified Password Policy for ProcuraMed:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (e.g. !, @, #, $, %, etc.)
 */

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    check: (pw) => (pw || '').length >= 8,
  },
  {
    id: 'hasUpper',
    label: 'At least 1 uppercase letter (A-Z)',
    check: (pw) => /[A-Z]/.test(pw || ''),
  },
  {
    id: 'hasLower',
    label: 'At least 1 lowercase letter (a-z)',
    check: (pw) => /[a-z]/.test(pw || ''),
  },
  {
    id: 'hasNumber',
    label: 'At least 1 number (0-9)',
    check: (pw) => /[0-9]/.test(pw || ''),
  },
  {
    id: 'hasSpecial',
    label: 'At least 1 special character (!, @, #, $, %, etc.)',
    check: (pw) => /[^a-zA-Z0-9]/.test(pw || ''),
  },
];

export const getPasswordCriteria = (password = '') => {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  };
};

export const isPasswordValid = (password = '') => {
  const criteria = getPasswordCriteria(password);
  return (
    criteria.minLength &&
    criteria.hasUpper &&
    criteria.hasLower &&
    criteria.hasNumber &&
    criteria.hasSpecial
  );
};

export const validatePasswordComplexity = (password = '') => {
  if (!password || !password.trim()) {
    return 'Password is required.';
  }

  const missing = [];
  if (password.length < 8) {
    missing.append ? missing.append('at least 8 characters') : missing.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    missing.push('at least 1 uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    missing.push('at least 1 lowercase letter (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    missing.push('at least 1 number (0-9)');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    missing.push('at least 1 special character (!, @, #, $, %, etc.)');
  }

  if (missing.length > 0) {
    return `Password must contain ${missing.join(', ')}.`;
  }

  return null;
};
