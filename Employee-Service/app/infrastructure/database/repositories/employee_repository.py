from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_, text
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.entities.employee import Employee, EmploymentStatus, VerificationStatus
from app.core.interfaces.repositories import EmployeeRepositoryInterface
from app.core.exceptions.employee_exceptions import EmployeeAlreadyExistsException
from app.infrastructure.database.models import EmployeeModel


class EmployeeRepository(EmployeeRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, employee: Employee) -> Employee:
        """Create a new employee with proper field mapping."""
        db_employee = EmployeeModel(
            id=employee.id,
            user_id=employee.user_id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=employee.phone,
            title=employee.title,
            department=employee.department,
            manager_id=employee.manager_id,
            employment_status=employee.employment_status.value,  
            verification_status=employee.verification_status.value,
            hired_at=employee.hired_at,
            deactivated_at=employee.deactivated_at,
            deactivation_reason=employee.deactivation_reason,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version,
            submitted_at=getattr(employee, 'submitted_at', None),
            final_approved_by=getattr(employee, 'final_approved_by', None),
            final_approved_at=getattr(employee, 'final_approved_at', None),
            rejection_reason=getattr(employee, 'rejection_reason', None),
            rejected_by=getattr(employee, 'rejected_by', None),
            rejected_at=getattr(employee, 'rejected_at', None)
        )
        
        try:
            self.session.add(db_employee)
            await self.session.commit()
            await self.session.refresh(db_employee)
            return self._to_entity(db_employee)
        except IntegrityError as e:
            await self.session.rollback()
            if "email" in str(e):
                raise EmployeeAlreadyExistsException("Employee with this email already exists")
            elif "user_id" in str(e):
                raise EmployeeAlreadyExistsException("Employee profile already exists for this user")
            raise
    
    async def get_by_id(self, employee_id: UUID) -> Optional[Employee]:
        """Get employee by ID with manager relationship."""
        result = await self.session.execute(
            select(EmployeeModel)
            .options(selectinload(EmployeeModel.manager))
            .where(EmployeeModel.id == employee_id)
        )
        db_employee = result.scalar_one_or_none()
        return self._to_entity(db_employee) if db_employee else None
    
    async def get_by_email(self, email: str) -> Optional[Employee]:
        """Get employee by email."""
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.email == email.lower())
        )
        db_employee = result.scalar_one_or_none()
        return self._to_entity(db_employee) if db_employee else None
    
    async def get_by_user_id(self, user_id: UUID) -> Optional[Employee]:
        """Get employee by user ID - CRITICAL for Auth Service integration."""
        result = await self.session.execute(
            select(EmployeeModel)
            .options(selectinload(EmployeeModel.manager))
            .where(EmployeeModel.user_id == user_id)
        )
        db_employee = result.scalar_one_or_none()
        return self._to_entity(db_employee) if db_employee else None
    
    async def get_by_manager_id(self, manager_id: UUID) -> List[Employee]:
        """Get all employees under a specific manager."""
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.manager_id == manager_id)
            .order_by(EmployeeModel.first_name, EmployeeModel.last_name)
        )
        db_employees = result.scalars().all()
        return [self._to_entity(emp) for emp in db_employees]
    
    async def update(self, employee: Employee) -> Employee:
        """Update employee with proper field mapping."""
        result = await self.session.execute(
            select(EmployeeModel).where(EmployeeModel.id == employee.id)
        )
        db_employee = result.scalar_one_or_none()
        
        if not db_employee:
            raise ValueError("Employee not found")
        
        db_employee.user_id = employee.user_id
        db_employee.first_name = employee.first_name
        db_employee.last_name = employee.last_name
        db_employee.email = employee.email
        db_employee.phone = employee.phone
        db_employee.title = employee.title
        db_employee.department = employee.department
        db_employee.manager_id = employee.manager_id
        db_employee.employment_status = employee.employment_status.value  
        db_employee.verification_status = employee.verification_status.value
        db_employee.hired_at = employee.hired_at
        db_employee.deactivated_at = employee.deactivated_at
        db_employee.deactivation_reason = employee.deactivation_reason
        db_employee.updated_at = employee.updated_at
        db_employee.version = employee.version
        
        if hasattr(employee, 'submitted_at'):
            db_employee.submitted_at = employee.submitted_at
        if hasattr(employee, 'final_approved_by'):
            db_employee.final_approved_by = employee.final_approved_by
        if hasattr(employee, 'final_approved_at'):
            db_employee.final_approved_at = employee.final_approved_at
        if hasattr(employee, 'rejection_reason'):
            db_employee.rejection_reason = employee.rejection_reason
        if hasattr(employee, 'rejected_by'):
            db_employee.rejected_by = employee.rejected_by
        if hasattr(employee, 'rejected_at'):
            db_employee.rejected_at = employee.rejected_at
        
        await self.session.commit()
        await self.session.refresh(db_employee)
        return self._to_entity(db_employee)
    
    async def delete(self, employee_id: UUID) -> bool:
        """Soft delete by setting status to INACTIVE."""
        result = await self.session.execute(
            select(EmployeeModel).where(EmployeeModel.id == employee_id)
        )
        db_employee = result.scalar_one_or_none()
        
        if db_employee:
            db_employee.employment_status = EmploymentStatus.INACTIVE.value  
            db_employee.deactivated_at = datetime.utcnow()
            db_employee.updated_at = datetime.utcnow()
            db_employee.version += 1
            
            await self.session.commit()
            return True
        return False
    
    async def list_employees(
        self,
        page: int = 1,
        size: int = 20,
        status: Optional[EmploymentStatus] = None,
        department: Optional[str] = None,
        manager_id: Optional[UUID] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """List employees with pagination and filtering."""
        
        query = select(EmployeeModel).options(selectinload(EmployeeModel.manager))
        
        conditions = []
        
        if status:
            conditions.append(EmployeeModel.employment_status == status.value) 
        
        if department:
            conditions.append(EmployeeModel.department.ilike(f"%{department}%"))
        
        if manager_id:
            conditions.append(EmployeeModel.manager_id == manager_id)
        
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    EmployeeModel.first_name.ilike(search_term),
                    EmployeeModel.last_name.ilike(search_term),
                    EmployeeModel.email.ilike(search_term),
                    EmployeeModel.title.ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        sort_column = getattr(EmployeeModel, sort_by, EmployeeModel.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        result = await self.session.execute(query)
        db_employees = result.scalars().all()
        
        employees = [self._to_entity(emp) for emp in db_employees]
        
        return {
            "employees": employees,
            "total": total,
            "page": page,
            "size": size
        }
    
    async def get_employee_count(self) -> int:
        """Get total active employee count."""
        result = await self.session.execute(
            select(func.count(EmployeeModel.id))
            .where(EmployeeModel.employment_status == EmploymentStatus.ACTIVE.value)
        )
        return result.scalar()
    
    async def check_circular_managership(self, employee_id: UUID, manager_id: UUID) -> bool:
        """Check if assigning manager would create circular relationship."""
        
        cte_query = text("""
            WITH RECURSIVE manager_hierarchy AS (
                -- Base case: start with the proposed manager
                SELECT id, manager_id, 1 as level
                FROM employees 
                WHERE id = :manager_id
                
                UNION ALL
                
                -- Recursive case: follow the manager chain
                SELECT e.id, e.manager_id, mh.level + 1
                FROM employees e
                INNER JOIN manager_hierarchy mh ON e.id = mh.manager_id
                WHERE mh.level < 10  -- Prevent infinite loops
            )
            SELECT COUNT(*) as count
            FROM manager_hierarchy 
            WHERE id = :employee_id
        """)
        
        result = await self.session.execute(
            cte_query, 
            {"manager_id": manager_id, "employee_id": employee_id}
        )
        count = result.scalar()
        
        return count > 0
    
    async def update_employee_profile_status(self, user_id: UUID, status: str) -> bool:
        """Update user's employee profile status via user_id."""
        result = await self.session.execute(
            select(EmployeeModel).where(EmployeeModel.user_id == user_id)
        )
        db_employee = result.scalar_one_or_none()
        
        if not db_employee:
            return False
        
        status_mapping = {
            "NOT_STARTED": VerificationStatus.NOT_SUBMITTED,
            "PENDING_VERIFICATION": VerificationStatus.PENDING_DETAILS_REVIEW, 
            "VERIFIED": VerificationStatus.VERIFIED,
            "REJECTED": VerificationStatus.REJECTED
        }
        
        mapped_status = status_mapping.get(status)
        if mapped_status:
            db_employee.verification_status = mapped_status.value
            db_employee.updated_at = func.now()
            await self.session.commit()
            return True
        
        return False
    
    async def get_employees_by_profile_status(self, status: str, limit: int = 100) -> List[Employee]:
        """Get employees by their profile status."""
        
        status_mapping = {
            "NOT_STARTED": VerificationStatus.NOT_SUBMITTED,
            "PENDING_VERIFICATION": VerificationStatus.PENDING_DETAILS_REVIEW,
            "VERIFIED": VerificationStatus.VERIFIED, 
            "REJECTED": VerificationStatus.REJECTED
        }
        
        mapped_status = status_mapping.get(status)
        if not mapped_status:
            return []
        
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.verification_status == mapped_status.value)
            .limit(limit)
            .order_by(EmployeeModel.created_at.desc())
        )
        db_employees = result.scalars().all()
        return [self._to_entity(db_employee) for db_employee in db_employees]
    
    async def get_employees_by_verification_status(
        self, 
        status: VerificationStatus, 
        limit: int = 100
    ) -> List[Employee]:
        """Get employees by verification status using enum."""
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.verification_status == status.value)
            .limit(limit)
            .order_by(EmployeeModel.submitted_at.asc()) 
        )
        db_employees = result.scalars().all()
        return [self._to_entity(db_employee) for db_employee in db_employees]
    
    def _to_entity(self, db_employee: EmployeeModel) -> Employee:
        """Convert database model to entity with proper field mapping."""
        return Employee(
            id=db_employee.id,
            user_id=db_employee.user_id,
            first_name=db_employee.first_name,
            last_name=db_employee.last_name,
            email=db_employee.email,
            phone=db_employee.phone,
            title=db_employee.title,
            department=db_employee.department,
            manager_id=db_employee.manager_id,
            employment_status=EmploymentStatus(db_employee.employment_status), 
            verification_status=VerificationStatus(db_employee.verification_status),
            hired_at=db_employee.hired_at,
            deactivated_at=db_employee.deactivated_at,
            deactivation_reason=db_employee.deactivation_reason,
            created_at=db_employee.created_at,
            updated_at=db_employee.updated_at,
            version=db_employee.version,
            submitted_at=getattr(db_employee, 'submitted_at', None),
            final_approved_by=getattr(db_employee, 'final_approved_by', None),
            final_approved_at=getattr(db_employee, 'final_approved_at', None),
            rejection_reason=getattr(db_employee, 'rejection_reason', None),
            rejected_by=getattr(db_employee, 'rejected_by', None),
            rejected_at=getattr(db_employee, 'rejected_at', None)
        )