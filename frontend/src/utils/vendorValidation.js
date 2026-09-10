/**
 * Validation rules and helpers for Vendor Supplier Application Form
 */

export const VENDOR_VALIDATION_RULES = {
  company_name: {
    required: 'Company name is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Company name cannot be blank';
      return true;
    }
  },

  contact_person: {
    required: 'Contact person name is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Contact person name cannot be blank';
      return true;
    }
  },

  email: {
    required: 'Business Email is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Business Email is required';
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

  address: {
    required: 'Company address is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Company address cannot be blank';
      return true;
    }
  },

  products_services_offered: {
    required: 'Products / Services description is required',
    validate: (val) => {
      if (!val || !val.trim()) return 'Products / Services description cannot be blank';
      return true;
    }
  },

  certificate_file: {
    required: 'Business License / Registration Certificate is required',
    validate: (files) => {
      if (!files || files.length === 0) {
        return 'Business License / Registration Certificate is required';
      }
      const file = files[0];
      const name = (file.name || '').toLowerCase();
      if (!name.endsWith('.pdf')) {
        return 'Only PDF files (.pdf) are allowed for the certificate';
      }
      if (file.type && file.type !== 'application/pdf') {
        return 'Only PDF files (.pdf) are allowed for the certificate';
      }
      return true;
    }
  }
};
