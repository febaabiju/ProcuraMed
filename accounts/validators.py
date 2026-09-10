import re
from rest_framework.exceptions import ValidationError


def validate_password_complexity(password: str) -> None:
    """
    Validates that a password satisfies the ProcuraMed unified password policy:
    1. Minimum 8 characters
    2. At least 1 uppercase letter (A-Z)
    3. At least 1 lowercase letter (a-z)
    4. At least 1 number (0-9)
    5. At least 1 special character (e.g. !, @, #, $, %, etc.)
    """
    if not password:
        raise ValidationError("Password is required.")

    missing = []
    if len(password) < 8:
        missing.append("at least 8 characters")
    if not re.search(r'[A-Z]', password):
        missing.append("at least one uppercase letter (A-Z)")
    if not re.search(r'[a-z]', password):
        missing.append("at least one lowercase letter (a-z)")
    if not re.search(r'[0-9]', password):
        missing.append("at least one number (0-9)")
    if not re.search(r'[^a-zA-Z0-9]', password):
        missing.append("at least one special character (!, @, #, $, %, etc.)")

    if missing:
        raise ValidationError(
            f"Password does not meet security requirements. It must contain {', '.join(missing)}."
        )
