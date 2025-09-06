# HRMS (Human Resource Management System)

A comprehensive HR management system built with modern microservices architecture, featuring employee management, authentication, task management, and administrative workflows.

## 🏗️ System Architecture

The system follows a microservices architecture with three main components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Auth Service   │    │Employee Service │
│  (React/TS)     │◄──►│   (FastAPI)     │◄──►│   (FastAPI)     │
│  Port: 5173     │    │   Port: 8000    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
```

## 🛠️ Technology Stack

### Frontend (auth-frontend)
- **Framework:** React 19.1.0 + TypeScript
- **Build Tool:** Vite
- **UI Framework:** Radix UI + Tailwind CSS
- **State Management:** TanStack Query + Context API
- **Routing:** React Router DOM v7
- **Form Handling:** React Hook Form + Zod validation
- **Real-time:** WebSocket integration
- **Charts:** Recharts
- **Notifications:** React Hot Toast + Sonner

### Backend Services

#### Auth Service (Port 8000)
- **Framework:** FastAPI 0.116.1
- **Database:** PostgreSQL with SQLAlchemy 2.0.35
- **Authentication:** JWT (PyJWT 2.10.1) with Argon2 password hashing
- **Email:** FastAPI-Mail integration
- **Security:** CORS middleware, Request validation
- **Features:**
  - User registration and authentication
  - JWT token management
  - Employee profile status tracking
  - Internal service API for microservice communication
  - Google OAuth integration ready

#### Employee Service (Port 8001)
- **Framework:** FastAPI 0.116.1
- **Database:** PostgreSQL with SQLAlchemy 2.0.35
- **File Storage:** Local file system with UUID organization
- **Communication:** HTTP client for Auth Service integration
- **Real-time:** WebSocket for notifications
- **Features:**
  - Employee profile management
  - Multi-stage admin approval workflow
  - Document upload and review system
  - Department management
  - Task management and assignment
  - Task collaboration and commenting
  - Role-based access control
  - Audit logging and compliance
  - Analytics and reporting

### Database
- **Primary Database:** PostgreSQL
- **Connection:** Async SQLAlchemy with connection pooling
- **Migrations:** Alembic for database schema management

## 🎯 Key Features

### Authentication & Authorization
- Secure user registration and login
- JWT-based authentication with refresh tokens
- Role-based access control (Admin, Manager, Employee)
- Employee profile status tracking
- Integration between Auth and Employee services

### Employee Management
- **Profile Submission:** Multi-step employee profile creation
- **Document Management:** Upload and review employee documents
- **Admin Workflow:** Multi-stage approval process with detailed review panels
- **Department Organization:** Hierarchical department structure
- **Audit Trail:** Complete history of profile changes and approvals

### Task Management System
- **Task Creation & Assignment:** Managers can create and assign tasks to employees
- **Real-time Collaboration:** WebSocket-powered task updates and notifications
- **Comment System:** Threaded discussions on tasks with real-time updates
- **Progress Tracking:** Task status management and progress visualization
- **Dashboard Views:** Role-specific dashboards for different user types

### Admin Features
- **Workflow Management:** Multi-stage approval process for employee profiles
- **Bulk Operations:** Batch processing of employee approvals
- **Department Management:** Create and manage organizational departments
- **Analytics Dashboard:** Comprehensive reporting and analytics
- **User Management:** Admin controls for user roles and permissions

### Manager Features
- **Team Management:** Overview of team members and their profiles
- **Task Assignment:** Create and assign tasks to team members
- **Department Oversight:** Manage department-specific tasks and employees
- **Progress Monitoring:** Track team performance and task completion

### Employee Features
- **Profile Management:** Complete employee profile submission and updates
- **Task Dashboard:** View assigned tasks and track progress
- **Document Upload:** Submit required documents for review
- **Collaboration:** Participate in task discussions and comments
- **Notifications:** Real-time updates on task assignments and status changes

### Technical Features
- **Real-time Communication:** WebSocket integration for live updates
- **File Management:** Secure document upload with organized storage
- **API Documentation:** Auto-generated OpenAPI/Swagger documentation
- **Error Handling:** Comprehensive error management with user-friendly messages
- **CORS Support:** Proper cross-origin resource sharing configuration
- **Health Monitoring:** Health check endpoints for service monitoring

## 📁 Project Structure

```
HRMS-trial/
├── auth-frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── admin/         # Admin-specific components
│   │   │   ├── auth/          # Authentication components
│   │   │   ├── dashboard/     # Dashboard components
│   │   │   ├── forms/         # Form components
│   │   │   ├── manager/       # Manager-specific components
│   │   │   ├── tasks/         # Task management components
│   │   │   └── ui/           # Base UI components (Radix + Tailwind)
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   └── types/           # TypeScript type definitions
│   └── package.json
├── Auth-Service/              # Authentication microservice
│   ├── app/
│   │   ├── core/            # Domain entities and business logic
│   │   ├── application/     # Use cases and DTOs
│   │   ├── infrastructure/  # Database, external services, security
│   │   └── presentation/    # API routes, middleware, schemas
│   └── requirements.txt
├── Employee-Service/          # Employee management microservice
│   ├── app/
│   │   ├── core/            # Domain entities and business logic
│   │   ├── application/     # Use cases and DTOs
│   │   ├── infrastructure/  # Database, external services, WebSocket
│   │   └── presentation/    # API routes, middleware, schemas
│   ├── uploads/             # File storage for employee documents
│   └── requirements.txt
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ for frontend
- Python 3.9+ for backend services
- PostgreSQL 13+
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd HRMS-trial
```

2. **Set up the frontend**
```bash
cd auth-frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

3. **Set up Auth Service**
```bash
cd Auth-Service
pip install -r requirements.txt
# Configure environment variables
uvicorn app.main:app --reload --port 8000
```

4. **Set up Employee Service**
```bash
cd Employee-Service
pip install -r requirements.txt
# Configure environment variables
uvicorn app.main:app --reload --port 8001
```

### Environment Configuration

Each service requires environment variables for database connections, JWT secrets, and service communication. Refer to the individual service directories for specific configuration requirements.

## 🔧 Development

### Frontend Development
- Uses Vite for fast development and hot module replacement
- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling

### Backend Development
- FastAPI with automatic API documentation
- SQLAlchemy ORM with async support
- Alembic for database migrations
- Pytest for testing

### Database Management
- PostgreSQL with separate schemas for each service
- Async connection pooling
- Database migrations managed via Alembic

## 📊 API Documentation

When running in development mode:
- **Auth Service:** http://localhost:8000/docs
- **Employee Service:** http://localhost:8001/docs

## 🔒 Security Features

- **Authentication:** JWT tokens with secure refresh mechanism
- **Password Security:** Argon2 hashing for password storage
- **CORS:** Properly configured cross-origin resource sharing
- **Input Validation:** Comprehensive request validation using Pydantic
- **File Upload Security:** Organized file storage with UUID-based organization
- **Role-based Access:** Fine-grained permission system

## 🎨 User Interface

The frontend provides different dashboards and interfaces for different user roles:

- **Admin Dashboard:** Comprehensive administrative controls and approval workflows
- **Manager Dashboard:** Team management and task assignment tools
- **Employee Dashboard:** Personal profile management and task collaboration
- **Analytics Views:** Data visualization and reporting capabilities

## 📈 Monitoring and Logging

- Health check endpoints for service monitoring
- Comprehensive logging with structured output
- Error tracking and handling
- Audit trail for compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note:** This is a comprehensive HRMS solution designed for modern HR workflows with focus on usability, security, and scalability.