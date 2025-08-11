from bcrypt import hashpw, gensalt, checkpw

class HashHelper(object):
    @staticmethod
    def hash_password(plain_password: str) -> str:
        """Hash a password using bcrypt."""
        return hashpw(plain_password.encode('utf-8'), gensalt()).decode('utf-8')

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hashed password."""
        return checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

    @staticmethod
    def get_password_hash(plain_password: str) -> str:
        """Get the hashed password."""
        return hashpw(
            plain_password.encode('utf-8'), gensalt()
        ).decode('utf-8')