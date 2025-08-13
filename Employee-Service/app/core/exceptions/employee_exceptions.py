class EmployeeException(Exception):
    """Base employee exception."""
    pass


class EmployeeNotFoundException(EmployeeException):
    """Raised when employee is not found."""
    pass


class EmployeeAlreadyExistsException(EmployeeException):
    """Raised when trying to create an employee that already exists."""
    pass


class EmployeeValidationException(EmployeeException):
    """Raised when employee data validation fails."""
    pass


class EmployeePermissionException(EmployeeException):
    """Raised when user lacks permission for employee operation."""
    pass


class ManagerNotFoundException(EmployeeException):
    """Raised when specified manager is not found."""
    pass


class CircularManagershipException(EmployeeException):
    """Raised when trying to create circular manager relationship."""
    pass


class EmployeeDeactivationException(EmployeeException):
    """Raised when employee deactivation fails."""
    pass