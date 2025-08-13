class RoleException(Exception):
    """Base role exception."""
    pass


class RoleNotFoundException(RoleException):
    """Raised when role is not found."""
    pass


class RoleAlreadyAssignedException(RoleException):
    """Raised when role is already assigned to user."""
    pass


class RoleNotAssignedException(RoleException):
    """Raised when trying to revoke unassigned role."""
    pass


class InvalidRoleCodeException(RoleException):
    """Raised when invalid role code is provided."""
    pass


class UnauthorizedException(RoleException):
    """Raised when user is not authenticated."""
    pass


class ForbiddenException(RoleException):
    """Raised when user lacks required permissions."""
    pass


class InsufficientPermissionsException(RoleException):
    """Raised when user has insufficient permissions for operation."""
    pass