# HireHub - MERN Job Portal

Placement-focused MERN job portal built for learning backend engineering, database design, authentication, authorization, API design, and real-world deployment practices.

This repository is being developed phase by phase. The current codebase already includes the Express server foundation, MongoDB connection layer, centralized error handling, and a health check endpoint. Frontend, auth flows, CRUD APIs, and advanced features will be added in later phases only after review and approval.

## Why this project exists

This project is designed as a resume-ready and interview-ready job portal that teaches how production systems are built. The goal is not only to finish features, but to understand the trade-offs behind every backend decision.

## Current Status

- Phase: 4 - Core Database Models complete
- Backend foundation: complete
- Database modeling: complete (6 Mongoose models)
- Authentication: next
- Authorization: pending
- Frontend: pending
- Advanced AI features: pending
## What this project will cover

Candidate features:

- Register, login, logout
- Profile management
- Resume upload
- Browse, search, and filter jobs
- Apply for jobs
- Track applications
- Candidate dashboard

Recruiter features:

- Recruiter registration and login
- Company profile management
- Job create, update, and delete
- View applicants
- Manage applications
- Dashboard analytics

Advanced features:

- AI resume analysis
- Skill extraction
- Job recommendations
- Recruiter analytics
- Email notifications

## Tech Stack

Frontend:

- React
- React Router
- Axios
- Context API

Backend:

- Node.js
- Express.js

Database:

- MongoDB Atlas
- Mongoose

Authentication and security:

- JWT access and refresh tokens
- Role-based access control
- Helmet
- CORS
- Rate limiting
- Cookie-based refresh token handling

File upload and email:

- Multer
- Cloudinary
- Nodemailer

Deployment:

- Render
- Vercel
- MongoDB Atlas

## Repository Layout

```text
job-portal/
├── README.md
├── client/
└── server/
    ├── app.js
    ├── server.js
    ├── config/
    ├── middleware/
    └── utils/
```

## Backend Architecture

The backend is separated into two main entry points:

- `server.js` starts the HTTP server, connects to MongoDB, and handles graceful shutdown.
- `app.js` configures the Express application, middleware, health check route, 404 handler, and global error middleware.

This separation is important because it makes the application easier to test. The Express app can be imported without binding to a port, which is better for integration tests and future automation.

### What is already implemented

- Environment validation before startup
- MongoDB connection bootstrap
- Helmet for security headers
- CORS configuration for frontend integration
- Global rate limiting
- JSON and URL-encoded body parsing
- Cookie parsing for refresh token support
- Development request logging
- Health check endpoint at `/api/v1/health`
- Centralized 404 and error handling
- Core Mongoose models for users, jobs, applications, companies, saved jobs, and notifications

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in the values.

Required variables:

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_EXPIRY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `GEMINI_API_KEY`
- `CLIENT_URL`

## Local Setup

### 1. Install dependencies

From the `server/` folder:

```bash
npm install
```

### 2. Create environment file

Create `server/.env` from `server/.env.example` and add your real credentials.

### 3. Start the backend

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

### 4. Verify the health check

Open:

```text
http://localhost:5000/api/v1/health
```

Expected response includes uptime, timestamp, environment, and database connection status.

## Phase-by-Phase Workflow

This project follows a strict learning order:

1. Project foundation
2. System design
3. Backend setup
4. Database design
5. Authentication
6. Authorization
7. CRUD APIs
8. Search and filtering
9. Resume upload
10. Frontend development
11. Dashboards
12. AI features
13. Notifications
14. Deployment
15. Testing and improvements

We will not jump ahead without review. Each phase should be explained, validated, and approved before the next one begins.

## Documentation Plan

The project is intended to maintain the following docs as development continues:

- `docs/PROJECT_CONTEXT.md`
- `docs/DECISION_LOG.md`
- `docs/INTERVIEW_NOTES.md`
- `docs/RESUME_BULLETS.md`
- `TECHNICAL_DEBT.md`
- `.ai-memory/AI_HANDOFF.md`
- `.ai-memory/NEXT_PHASE_CONTEXT.md`
- `.ai-memory/SESSION_RECOVERY_PROMPT.md`

These files are meant to capture architecture decisions, learning notes, interview preparation, and handoff context.

## Git and Branching Strategy

Recommended branch pattern:

- `feature/auth`
- `feature/jobs`
- `feature/dashboard`
- `fix/token-validation`
- `docs/interview-notes`

Recommended commit style:

- `feat(auth): implement user registration`
- `feat(job): add job creation api`
- `fix(auth): resolve token validation bug`
- `docs(phase-03): update backend setup notes`

Commit after meaningful progress so the history stays readable and easy to review.

## Resume Value

This project is strong for resumes because it demonstrates:

- Full-stack application architecture
- MongoDB schema design
- JWT-based authentication
- Role-based authorization
- File upload and email integration
- Security-minded backend development
- Real deployment workflow

If a feature does not add meaningful learning or interview value, it should be questioned before adding it.

## Technical Debt Tracker

If shortcuts are taken, they should be documented in `TECHNICAL_DEBT.md` with:

- Issue
- Impact
- Priority
- Recommended fix

This keeps the project honest and makes future refactoring intentional.

## Notes for Contributors

- Backend quality takes priority over UI styling.
- Security and validation should be treated as first-class concerns.
- Database schema decisions should always be justified.
- Every major phase should be reviewed before moving forward.

## Next Step

The next phase is Phase 5: Auth Module. It should implement auth service/controller/routes, JWT auth middleware, role middleware, Joi validation middleware, auth validators, and password reset email support. Do not proceed beyond this phase without review and approval.