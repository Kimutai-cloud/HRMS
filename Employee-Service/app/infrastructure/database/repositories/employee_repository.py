from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_, text
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.entities.employee import Employee, EmploymentStatus
from app.core.interfaces.repositories import EmployeeRepositoryInterface
from app.core.exceptions.employee_exceptions import EmployeeAlreadyExistsException
from app.infrastructure.database.models import EmployeeModel


class EmployeeRepository(EmployeeRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, employee: Employee) -> Employee:
        db_employee = EmployeeModel(
            id=employee.id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=employee.phone,
            title=employee.title,
            department=employee.department,
            manager_id=employee.manager_id,
            status=employee.status.value,
            hired_at=employee.hired_at,
            deactivated_at=employee.deactivated_at,
            deactivation_reason=employee.deactivation_reason,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version
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
            raise
    
    async def get_by_id(self, employee_id: UUID) -> Optional[Employee]:
        result = await self.session.execute(
            select(EmployeeModel)
            .options(selectinload(EmployeeModel.manager))
            .where(EmployeeModel.id == employee_id)
        )
        db_employee = result.scalar_one_or_none()
        return self._to_entity(db_employee) if db_employee else None
    
    async def get_by_email(self, email: str) -> Optional[Employee]:
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.email == email.lower())
        )
        db_employee = result.scalar_one_or_none()
        return self._to_entity(db_employee) if db_employee else None
    
    async def get_by_manager_id(self, manager_id: UUID) -> List[Employee]:
        result = await self.session.execute(
            select(EmployeeModel)
            .where(EmployeeModel.manager_id == manager_id)
            .order_by(EmployeeModel.first_name, EmployeeModel.last_name)
        )
        db_employees = result.scalars().all()
        return [self._to_entity(emp) for emp in db_employees]
    
    async def update(self, employee: Employee) -> Employee:
        result = await self.session.execute(
            select(EmployeeModel).where(EmployeeModel.id == employee.id)
        )
        db_employee = result.scalar_one_or_none()
        
        if not db_employee:
            raise ValueError("Employee not found")
        
        # Update fields
        db_employee.first_name = employee.first_name
        db_employee.last_name = employee.last_name
        db_employee.email = employee.email
        db_employee.phone = employee.phone
        db_employee.title = employee.title
        db_employee.department = employee.department
        db_employee.manager_id = employee.manager_id
        db_employee.status = employee.status.value
        db_employee.hired_at = employee.hired_at
        db_employee.deactivated_at = employee.deactivated_at
        db_employee.deactivation_reason = employee.deactivation_reason
        db_employee.updated_at = employee.updated_at
        db_employee.version = employee.version
        
        await self.session.commit()
        await self.session.refresh(db_employee)
        return self._to_entity(db_employee)
    
    async def delete(self, employee_id: UUID) -> bool:
        result = await self.session.execute(
            select(EmployeeModel).where(EmployeeModel.id == employee_id)
        )
        db_employee = result.scalar_one_or_none()
        
        if db_employee:
            # Soft delete by setting status to INACTIVE
            db_employee.status = EmploymentStatus.INACTIVE.value
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
        # Build base query
        query = select(EmployeeModel).options(selectinload(EmployeeModel.manager))
        
        # Apply filters
        conditions = []
        
        if status:
            conditions.append(EmployeeModel.status == status.value)
        
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
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply sorting
        sort_column = getattr(EmployeeModel, sort_by, EmployeeModel.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Apply pagination
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        # Execute query
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
        result = await self.session.execute(
            select(func.count(EmployeeModel.id))
            .where(EmployeeModel.status == EmploymentStatus.ACTIVE.value)
        )
        return result.scalar()
    
    async def check_circular_managership(self, employee_id: UUID, manager_id: UUID) -> bool:
        """Check if assigning manager would create circular relationship using recursive CTE."""
        
        # Recursive CTE to check manager hierarchy
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
    
    def _to_entity(self, db_employee: EmployeeModel) -> Employee:
        return Employee(
            id=db_employee.id,
            first_name=db_employee.first_name,
            last_name=db_employee.last_name,
            email=db_employee.email,
            phone=db_employee.phone,
            title=db_employee.title,
            department=db_employee.department,
            manager_id=db_employee.manager_id,
            status=EmploymentStatus(db_employee.status),
            hired_at=db_employee.hired_at,
            deactivated_at=db_employee.deactivated_at,
            deactivation_reason=db_employee.deactivation_reason,
            created_at=db_employee.created_at,
            updated_at=db_employee.updated_at,
            version=db_employee.version
        )