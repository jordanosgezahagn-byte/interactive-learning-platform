# Interactive E-Learning Platform

## Local frontend and API connection

The frontend sends API requests to `/api` on its own origin. Vite's development and preview servers proxy those requests to `http://localhost:3000`, keeping session cookies available regardless of whether the frontend is opened using `localhost`, `127.0.0.1`, or a fallback port. Start the backend on port 3000 before using dashboards. If the API uses a different address, set `VITE_API_URL` to its base URL and configure the deployment to keep frontend and API requests same-site for authentication.

## Gmail verification setup

New registrations accept Gmail addresses only and cannot sign in until the address is verified.

1. Enable 2-Step Verification on the Gmail account used to send app email, then create a Google App Password. Use the App Password, not the regular Gmail password.
2. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `backend/.env`. Keep this file private and never commit or share the App Password.
3. Apply `database/migrations/001_email_verification.sql` once to the `interactive_learning_platform` database in phpMyAdmin. This marks existing accounts as verified and creates storage for new verification links.
4. Restart the backend and frontend. Registration will send a verification link to the new user's Gmail inbox; links expire after 24 hours.

Users who haven't received the message can select **Resend verification link** on the login page. Resends are limited to one per minute per account.

## Instructor course authoring

Instructor accounts can create and edit courses, add modules and lessons, enter lesson explanations and code examples, upload supporting materials, create code exercises and multiple-choice quizzes, and review course enrollment and progress. In the student performance table, instructors can open each student's submitted work to inspect exercise responses and quiz attempts with per-question answers and scores, mark exercises correct or needing work, and leave feedback visible to the student.

1. Apply `database/migrations/002_instructor_materials.sql` after the email-verification migration. It adds lesson code examples and the course-material records.
2. Restart the backend and frontend and sign in using an account assigned the `instructor` role.
3. Uploads are stored in `backend/uploads` (excluded from Git), limited to 10 MB, and accept PDF, TXT, Markdown, ZIP, PNG, and JPEG files.

The course-authoring API verifies instructor ownership. A course must contain at least one lesson before it can be published. The instructor dashboard also offers HTML/CSS and JavaScript starter courses with an initial lesson, exercise, and quiz; these are created as editable drafts and are not visible to students until published.

Published courses appear in the public course catalog. Students can enroll, view their instructor's published lessons and quizzes, submit exercises and quiz attempts, and save lesson completion. The student dashboard only lists courses the student is actually enrolled in; the HTML editor available from the home page is a standalone sample lesson.

## Running course examples

The course editor runs HTML/CSS and JavaScript in a restricted browser preview. Python examples run in Pyodide, which downloads its pinned WebAssembly runtime from jsDelivr on first use; learner code stays in the browser. PHP examples run in a local WebAssembly runtime and do not connect to a server or database. MySQL lessons run common SQL statements in a local SQLite-based practice sandbox with sample rows; MySQL-specific features outside the supported subset are not available.

## Administrator dashboard

Administrators can view platform totals, manage user roles and account access, assign instructors and categories to courses, manage categories, review/revoke certificates, and process reports submitted against published courses and lessons. The first active administrator cannot be disabled or demoted, and administrators cannot edit their own account.

Apply `database/migrations/003_content_reports.sql` after the existing migrations to enable the learner reporting flow and administrator report queue. Fresh databases created from `database/schema.sql` already include the report table.
