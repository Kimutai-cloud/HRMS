#!/usr/bin/env python3
"""
Test script for Task Management Phase 2 implementation.
Tests basic repository operations and domain logic.
"""

import asyncio
import sys
import os
from uuid import uuid4
from datetime import datetime, timezone, timedelta

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.entities.task import Task, TaskType, Priority, TaskStatus, TaskComment, CommentType
from app.infrastructure.database.repositories.task_repository import TaskRepository
from app.infrastructure.database.repositories.task_comment_repository import TaskCommentRepository
from app.infrastructure.database.repositories.task_activity_repository import TaskActivityRepository


async def test_task_repository_basic_operations():
    """Test basic task repository operations."""
    print("🧪 Testing Task Repository Basic Operations...")
    
    # Database connection
    DATABASE_URL = "postgresql+asyncpg://hrms_user:hrms_password@localhost:5432/hrms_db"
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        task_repo = TaskRepository(session)
        
        # Test data - we'll use existing employee IDs from the database
        print("  📋 Getting existing employee IDs from database...")
        
        # Get some employee IDs for testing
        from sqlalchemy import text
        result = await session.execute(text("SELECT id FROM employees LIMIT 2"))
        employees = result.fetchall()
        
        if len(employees) < 2:
            print("  ❌ Need at least 2 employees in database for testing")
            return False
        
        manager_id = employees[0][0]
        assignee_id = employees[1][0] 
        
        print(f"  👤 Using Manager ID: {manager_id}")
        print(f"  👤 Using Assignee ID: {assignee_id}")
        
        # Create a test task using the entity
        print("  ➕ Creating test task...")
        test_task = Task(
            id=uuid4(),
            title="Test Task - Phase 2 Implementation",
            description="Testing the Phase 2 task management implementation",
            task_type=TaskType.TASK,
            priority=Priority.HIGH,
            status=TaskStatus.DRAFT,
            assignee_id=None,  # Will assign later
            assigner_id=manager_id,
            department_id=None,
            parent_task_id=None,
            progress_percentage=0,
            estimated_hours=8.0,
            actual_hours=None,
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            tags=["testing", "phase2"],
            attachments=[],
            version=1
        )
        
        # Test Create
        created_task = await task_repo.create(test_task)
        print(f"  ✅ Task created with ID: {created_task.id}")
        print(f"     Title: {created_task.title}")
        print(f"     Status: {created_task.status.value}")
        print(f"     Priority: {created_task.priority.value}")
        
        # Test Read
        print("  📖 Testing task retrieval...")
        retrieved_task = await task_repo.get_by_id(created_task.id)
        if retrieved_task:
            print(f"  ✅ Task retrieved successfully")
            print(f"     Title: {retrieved_task.title}")
            print(f"     Due Date: {retrieved_task.due_date}")
        else:
            print("  ❌ Failed to retrieve task")
            return False
        
        # Test Update - Assign task
        print("  🔄 Testing task assignment...")
        retrieved_task.assign_to(assignee_id, manager_id)
        updated_task = await task_repo.update(retrieved_task)
        print(f"  ✅ Task assigned to: {updated_task.assignee_id}")
        print(f"     Status changed to: {updated_task.status.value}")
        print(f"     Assigned at: {updated_task.assigned_at}")
        
        # Test workflow progression
        print("  ⚡ Testing workflow progression...")
        
        # Start work
        updated_task.start_work()
        updated_task = await task_repo.update(updated_task)
        print(f"  ✅ Work started - Status: {updated_task.status.value}")
        
        # Update progress
        updated_task.update_progress(50, 4.0)
        updated_task = await task_repo.update(updated_task)
        print(f"  ✅ Progress updated: {updated_task.progress_percentage}% (4.0 hours)")
        
        # Submit for review
        updated_task.submit_for_review("Task completed, ready for review")
        updated_task = await task_repo.update(updated_task)
        print(f"  ✅ Submitted for review - Status: {updated_task.status.value}")
        
        # Test queries
        print("  🔍 Testing repository queries...")
        
        # Get tasks by assignee
        assignee_tasks = await task_repo.get_tasks_by_assignee(assignee_id)
        print(f"  ✅ Found {len(assignee_tasks)} tasks for assignee")
        
        # Get tasks by assigner (manager)
        manager_tasks = await task_repo.get_tasks_by_assigner(manager_id)
        print(f"  ✅ Found {len(manager_tasks)} tasks created by manager")
        
        # Search tasks
        search_results = await task_repo.search_tasks(
            title_search="Phase 2",
            status=TaskStatus.SUBMITTED,
            priority=Priority.HIGH,
            limit=10
        )
        print(f"  ✅ Search returned {len(search_results)} tasks")
        
        # Get statistics
        stats = await task_repo.get_task_statistics(manager_id, is_manager=True)
        print(f"  ✅ Manager statistics: {stats}")
        
        # Clean up
        print("  🧹 Cleaning up test data...")
        deleted = await task_repo.delete(created_task.id)
        if deleted:
            print("  ✅ Test task deleted successfully")
        else:
            print("  ❌ Failed to delete test task")
            
        return True


async def test_task_comment_repository():
    """Test task comment repository operations."""
    print("💬 Testing Task Comment Repository...")
    
    DATABASE_URL = "postgresql+asyncpg://hrms_user:hrms_password@localhost:5432/hrms_db"
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        task_repo = TaskRepository(session)
        comment_repo = TaskCommentRepository(session)
        
        # Create a test task first
        from sqlalchemy import text
        result = await session.execute(text("SELECT id FROM employees LIMIT 2"))
        employees = result.fetchall()
        
        if len(employees) < 2:
            print("  ❌ Need at least 2 employees for testing")
            return False
        
        manager_id = employees[0][0]
        employee_id = employees[1][0]
        
        # Create test task
        test_task = Task(
            id=uuid4(),
            title="Test Task for Comments",
            description="Testing comment functionality",
            task_type=TaskType.TASK,
            priority=Priority.MEDIUM,
            status=TaskStatus.ASSIGNED,
            assignee_id=employee_id,
            assigner_id=manager_id,
            department_id=None,
            parent_task_id=None,
            estimated_hours=4.0,
            tags=["test", "comments"]
        )
        
        created_task = await task_repo.create(test_task)
        print(f"  📋 Created test task: {created_task.id}")
        
        # Create test comment
        test_comment = TaskComment(
            id=uuid4(),
            task_id=created_task.id,
            author_id=employee_id,
            comment="This is a test comment for the task management system.",
            comment_type=CommentType.COMMENT
        )
        
        created_comment = await comment_repo.create(test_comment)
        print(f"  💬 Created comment: {created_comment.id}")
        print(f"     Comment: {created_comment.comment}")
        print(f"     Type: {created_comment.comment_type.value}")
        
        # Get comments for task
        task_comments = await comment_repo.get_by_task_id(created_task.id)
        print(f"  ✅ Retrieved {len(task_comments)} comments for task")
        
        # Update comment
        created_comment.update_comment("Updated comment text")
        updated_comment = await comment_repo.update(created_comment)
        print(f"  ✅ Updated comment: {updated_comment.comment}")
        
        # Add another comment (status change type)
        status_comment = TaskComment(
            id=uuid4(),
            task_id=created_task.id,
            author_id=manager_id,
            comment="Task status changed to IN_PROGRESS",
            comment_type=CommentType.STATUS_CHANGE
        )
        
        await comment_repo.create(status_comment)
        
        # Get all comments again
        all_comments = await comment_repo.get_by_task_id(created_task.id)
        print(f"  ✅ Now have {len(all_comments)} comments total")
        
        for comment in all_comments:
            print(f"    - {comment.comment_type.value}: {comment.comment}")
        
        # Clean up
        print("  🧹 Cleaning up...")
        for comment in all_comments:
            await comment_repo.delete(comment.id)
        await task_repo.delete(created_task.id)
        print("  ✅ Cleanup completed")
        
        return True


async def test_entity_business_logic():
    """Test task entity business logic and state machine."""
    print("🏛️ Testing Task Entity Business Logic...")
    
    # Test task creation and validation
    print("  ➕ Testing task creation...")
    task = Task(
        id=uuid4(),
        title="Business Logic Test",
        description="Testing entity business rules",
        task_type=TaskType.TASK,
        priority=Priority.MEDIUM,
        status=TaskStatus.DRAFT,
        assignee_id=None,
        assigner_id=uuid4(),
        department_id=None,
        parent_task_id=None
    )
    print(f"  ✅ Task created - Status: {task.status.value}")
    
    # Test state machine - assign task
    print("  🔄 Testing state transitions...")
    assignee_id = uuid4()
    assigner_id = task.assigner_id
    
    try:
        task.assign_to(assignee_id, assigner_id)
        print(f"  ✅ Task assigned - Status: {task.status.value}")
        print(f"     Assignee: {task.assignee_id}")
        print(f"     Assigned at: {task.assigned_at}")
    except Exception as e:
        print(f"  ❌ Assignment failed: {e}")
        return False
    
    # Start work
    try:
        task.start_work()
        print(f"  ✅ Work started - Status: {task.status.value}")
        print(f"     Started at: {task.started_at}")
    except Exception as e:
        print(f"  ❌ Start work failed: {e}")
        return False
    
    # Update progress
    try:
        task.update_progress(75, 6.5)
        print(f"  ✅ Progress updated: {task.progress_percentage}%")
        print(f"     Actual hours: {task.actual_hours}")
    except Exception as e:
        print(f"  ❌ Progress update failed: {e}")
        return False
    
    # Submit for review
    try:
        task.submit_for_review("Ready for manager review")
        print(f"  ✅ Submitted - Status: {task.status.value}")
        print(f"     Submitted at: {task.submitted_at}")
        print(f"     Progress: {task.progress_percentage}%")  # Should be 100%
    except Exception as e:
        print(f"  ❌ Submit failed: {e}")
        return False
    
    # Start review
    try:
        task.start_review(assigner_id)
        print(f"  ✅ Review started - Status: {task.status.value}")
        print(f"     Reviewed at: {task.reviewed_at}")
    except Exception as e:
        print(f"  ❌ Start review failed: {e}")
        return False
    
    # Approve task
    try:
        task.approve_task(assigner_id, "Great work! Task completed successfully.")
        print(f"  ✅ Task approved - Status: {task.status.value}")
        print(f"     Completed at: {task.completed_at}")
        print(f"     Approval notes: {task.approval_notes}")
    except Exception as e:
        print(f"  ❌ Approval failed: {e}")
        return False
    
    # Test invalid state transitions
    print("  🚫 Testing invalid transitions...")
    try:
        task.start_work()  # Should fail - task is already completed
        print("  ❌ Should have failed to start work on completed task")
        return False
    except ValueError as e:
        print(f"  ✅ Correctly prevented invalid transition: {e}")
    
    # Test business rule validations
    print("  ⚖️ Testing business rule validations...")
    try:
        invalid_task = Task(
            id=uuid4(),
            title="",  # Empty title should fail
            description="Test",
            task_type=TaskType.TASK,
            priority=Priority.MEDIUM,
            status=TaskStatus.DRAFT,
            assignee_id=None,
            assigner_id=uuid4(),
            department_id=None,
            parent_task_id=None
        )
        print("  ❌ Should have failed validation for empty title")
        return False
    except ValueError as e:
        print(f"  ✅ Correctly validated title requirement: {e}")
    
    print("  ✅ All business logic tests passed!")
    return True


async def main():
    """Run all tests."""
    print("🚀 Starting Task Management Phase 2 Tests...\n")
    
    tests = [
        ("Entity Business Logic", test_entity_business_logic),
        ("Task Repository", test_task_repository_basic_operations),
        ("Comment Repository", test_task_comment_repository),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"{'='*60}")
        print(f"Running: {test_name}")
        print(f"{'='*60}")
        
        try:
            result = await test_func()
            results.append((test_name, result))
            if result:
                print(f"✅ {test_name} - PASSED\n")
            else:
                print(f"❌ {test_name} - FAILED\n")
        except Exception as e:
            print(f"❌ {test_name} - ERROR: {e}\n")
            results.append((test_name, False))
    
    # Summary
    print(f"{'='*60}")
    print("TEST RESULTS SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All Phase 2 tests passed! Implementation is working correctly.")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed. Check implementation.")
        return False


if __name__ == "__main__":
    asyncio.run(main())