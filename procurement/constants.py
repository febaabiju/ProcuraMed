"""
Procurement Department-to-Category Mappings and Constants.
The single backend source of truth for procurement categories allowed per hospital department.
"""

DEPARTMENT_CATEGORY_MAP = {
    'Medical & Clinical Services': [
        'Medical Equipment & Devices',
        'Surgical Instruments',
        'Medical Consumables',
        'ICU & Critical Care Equipment',
    ],
    'Biomedical Engineering': [
        'Biomedical Equipment',
        'Maintenance & Technical Services',
    ],
    'Laboratory & Diagnostic Services': [
        'Laboratory Equipment & Supplies',
        'Diagnostic Equipment',
        'Radiology & Imaging Equipment',
    ],
    'Facilities & Support Services': [
        'Maintenance & Technical Services',
        'Cleaning & Housekeeping Supplies',
        'General Hospital Supplies',
    ],
    'IT & Digital Services': [
        'IT Hardware & Software',
    ],
    'Administration & General Supplies': [
        'Hospital Furniture & Fixtures',
        'General Hospital Supplies',
    ],
    'Central Stores & Logistics': [
        'General Hospital Supplies',
        'Medical Consumables',
    ],
}

# Legacy department mapping to ensure backward compatibility for historical requisitions,
# legacy logs, or tests referencing former department names.
LEGACY_DEPARTMENT_MAPPING = {
    'Medical & Surgical Equipment': 'Medical & Clinical Services',
    'Radiology & Imaging': 'Laboratory & Diagnostic Services',
    'Medical Consumables': 'Medical & Clinical Services',
    'Critical Care & Emergency Services': 'Medical & Clinical Services',
    'Operation Theatre & Sterilization': 'Medical & Clinical Services',
    'Facilities & Maintenance': 'Facilities & Support Services',
    'Housekeeping & Laundry': 'Facilities & Support Services',
    'Furniture, Office & General Supplies': 'Administration & General Supplies',
    'Administration & Office Management': 'Administration & General Supplies',
}


def get_allowed_categories_for_department(department_name):
    """
    Returns a list of allowed item categories for a given hospital department name.
    Supports both official 7 departments and legacy department names for historical data.
    If the department is unassigned or not recognized, returns an empty list.
    """
    if not department_name:
        return []
    clean_name = str(department_name).strip()
    if clean_name in DEPARTMENT_CATEGORY_MAP:
        return DEPARTMENT_CATEGORY_MAP[clean_name]
    
    # Check legacy mapping fallback
    mapped_name = LEGACY_DEPARTMENT_MAPPING.get(clean_name)
    if mapped_name and mapped_name in DEPARTMENT_CATEGORY_MAP:
        return DEPARTMENT_CATEGORY_MAP[mapped_name]

    return []
