from .base import BaseRepository
from app.db.models.user import User 
from app.db.schema.user import UserInCreate

class UserRepository(BaseRepository):
    def user_exist_by_email(self, email: str) -> bool:
        user = self.session.query(User).filter(User.email == email).first()
        return bool(user)

    def get_user_by_email(self, email: str) -> User | None:
        user = self.session.query(User).filter(User.email == email).first()
        return user  

    def get_user_by_id(self, user_id: int) -> User | None:
        user = self.session.query(User).filter(id = user_id).first()
        return user  

    def create_user(self, user_data : UserInCreate):
        new_user = User(**user_data.model_dump(exclude_none=True))
        self.session.add(instance=new_user)
        self.session.commit()
        self.session.refresh(instance=new_user)
        return new_user

    def update_user(self, user_id: int, user_data):
        user = self.get_user_by_id(user_id)
        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
            self.session.commit()
            self.session.refresh(user)
            return user
        return None

    def delete_user(self, user_id: int):
        user = self.get_user_by_id(user_id)
        if user:
            self.session.delete(user)
            self.session.commit()
            return True
        return False