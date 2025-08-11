class AuthException(Exception):
    """Base authentication exception."""
    pass


class UserNotFoundException(AuthException):
    """Raised when user is not found."""
    pass


class UserAlreadyExistsException(AuthException):
    """Raised when trying to create a user that already exists."""
    pass


class InvalidCredentialsException(AuthException):
    """Raised when login credentials are invalid."""
    pass


class TokenExpiredException(AuthException):
    """Raised when token has expired."""
    pass


class TokenInvalidException(AuthException):
    """Raised when token is invalid."""
    pass


class EmailNotVerifiedException(AuthException):
    """Raised when user email is not verified."""
    pass


class GoogleAuthException(AuthException):
    """Raised when Google authentication fails."""
    pass
