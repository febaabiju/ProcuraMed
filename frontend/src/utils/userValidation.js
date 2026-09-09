/**
 * Shared validation rules and helpers for Admin Add User forms:
 * 1. Department Staff
 * 2. Purchase Officer
 * 3. Procurement Committee Member
 * 4. Technical Officer
 */

export const USER_VALIDATION_RULES = {
  employee_id: {
    required: 'Employee ID is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Employee ID is required';
      if (!/^[a-zA-Z0-9]+$/.test(val)) {
        return 'Employee ID must contain only letters and numbers (no spaces or special characters)';
      }
      const hasLetter = /[a-zA-Z]/.test(val);
      const hasNumber = /[0-9]/.test(val);
      if (!hasLetter || !hasNumber) {
        return 'Employee ID must contain both letters and numbers';
      }
      return true;
    }
  },

  username: {
    required: 'Username is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Username is required';
      if (/[A-Z]/.test(val)) return 'Uppercase letters are not allowed in username';
      if (/\s/.test(val)) return 'Spaces are not allowed in username';
      if (!/^[a-z0-9._]+$/.test(val)) {
        return 'Only lowercase letters (a-z), numbers (0-9), underscore (_), and period (.) are allowed';
      }
      const hasLetter = /[a-z]/.test(val);
      const hasNumber = /[0-9]/.test(val);
      const hasSymbol = /[._]/.test(val);
      if (!hasLetter || !hasNumber || !hasSymbol) {
        return 'Username must contain at least one lowercase letter, one number, and one underscore (_) or period (.)';
      }
      return true;
    }
  },

  first_name: {
    required: 'First name is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'First name cannot be blank';
      return true;
    }
  },

  last_name: {
    required: 'Last name is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Last name cannot be blank';
      return true;
    }
  },

  date_of_birth: {
    required: 'Date of birth is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Date of birth is required';
      const parts = val.split('-');
      const year = parseInt(parts[0], 10);
      if (isNaN(year) || year < 1950 || year > 2006) {
        return 'Date of birth must be between 1950 and 2006';
      }
      return true;
    }
  },

  gender: {
    required: 'Gender is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Gender is required';
      if (!['Male', 'Female'].includes(val)) return 'Please select a valid gender';
      return true;
    }
  },

  email: {
    required: 'Email address is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Email address is required';
      if (/[A-Z]/.test(val)) return 'Email must be in lowercase and end with @gmail.com';
      if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(val)) {
        return 'Email must be a valid Gmail address ending with @gmail.com';
      }
      return true;
    }
  },

  phone: {
    required: 'Phone number is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Phone number is required';
      if (!/^\d{10}$/.test(val)) {
        return 'Phone number must contain exactly 10 digits';
      }
      return true;
    }
  },

  department: {
    required: 'Hospital department is required',
    validate: (val) => {
      if (!val || !String(val).trim()) return 'Hospital department is required';
      return true;
    }
  }
};

/**
 * Maps server-side validation error dictionary into react-hook-form setError
 */
export const applyServerFieldErrors = (errData, setError) => {
  if (errData && typeof errData === 'object' && !Array.isArray(errData)) {
    Object.entries(errData).forEach(([field, messages]) => {
      const msg = Array.isArray(messages) ? messages[0] : String(messages);
      if (typeof setError === 'function') {
        setError(field, { type: 'server', message: msg });
      }
    });
  }
};
