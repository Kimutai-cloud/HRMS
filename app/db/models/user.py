from app.core.database import Base
from sqlalchemy import Column, Integer, String  

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(70), unique=True)
    first_name = Column(String(50))
    last_name = Column(String(100))
    password = Column(String(250))