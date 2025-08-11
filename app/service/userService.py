from app.db.repository.userRepository import UserRepository
from app.db.schema.user import UserInCreate, UserOutput, UserInLogin, UserWithToken
from app.core.security.hashHelper import HashHelper
from app.core.security.authHandler import authHandler
from sqlalchemy.orm import Session
from fastapi import HTTPException


class UserService:
    def __init__(self, session: Session):
        self.__userRepository = UserRepository(session=session)

    
    def signup(self, user_details : UserInCreate) -> UserOutput:
        if self.__userRepository.user_exist_by_email(email=user_details.email):
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = HashHelper.get_password_hash(plain_password=user_details.password)
        user_details.password = hashed_password
        
        return self.__userRepository.create_user(user_data=user_details)

    def login(self, login_details: UserInLogin) -> UserWithToken:
        userE = self.__userRepository.user_exist_by_email(email=login_details.email)
        if not userE :
            raise HTTPException(status_code=401, detail="Please create an account first")
        
        user = self.__userRepository.get_user_by_email(email=login_details.email)
        if HashHelper.verify_password(plain_password=login_details.password, hashed_password=user.password):
            token = authHandler.sign_jwt(user_id=user.id)
            if token:
                return UserWithToken(token=token)
            raise HTTPException(status_code=500, detail="Unable to process request")
        raise HTTPException(status_code=400, detail="Invalid credentials")
