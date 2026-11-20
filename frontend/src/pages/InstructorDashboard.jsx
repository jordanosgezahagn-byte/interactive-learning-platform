import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, BookOpen, Check, ChevronRight, Code2, FileText, Trash2,
  GraduationCap, LayoutDashboard, LogOut, Plus, Settings, Users,
} from 'lucide-react';
import { API_URL, apiRequest } from '../lib/api';

const apiOrigin = API_URL.replace(/\/api\/?$/, '');

const initialCourseForm = {
  title: '',
  description: '',
  difficulty: 'beginner',
  estimatedMinutes: 0,
};

export default function InstructorDashboard({
  user, today, initials, onLogout, isLoggingOut, logoutError,
}) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [course, setCourse] = useState(null);
  const [loadedCourseId, setLoadedCourseId] = useState('');
  const [failedCourseId, setFailedCourseId] = useState('');
  const [students, setStudents] = useState([]);
  const [expandedStudentId, setExpandedStudentId] = useState('');
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeCourse = course?.id === selectedCourseId ? course : null;
  const loadingCourse = Boolean(selectedCourseId)
    && loadedCourseId !== selectedCourseId
    && failedCourseId !== selectedCourseId;

  async function refreshCourses() {
    const { courses: updatedCourses } = await apiRequest('/instructor/courses');
    setCourses(updatedCourses);
    return updatedCourses;
  }

  async function refreshCourse(courseId = selectedCourseId) {
    if (!courseId) return;
    const [{ course: updatedCourse }, { students: updatedStudents }] = await Promise.all([
      apiRequest(`/instructor/courses/${courseId}`),
      apiRequest(`/instructor/courses/${courseId}/students`),
    ]);
    setCourse(updatedCourse);
    setStudents(updatedStudents);
  }

  async function perform(action, successMessage) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest('/instructor/courses')
      .then(({ courses: loadedCourses }) => {
        if (!active) return;
        setCourses(loadedCourses);
        const preferredCourse = loadedCourses.find((item) => (
          Number(item.pending_certificate_count) > 0
        )) || loadedCourses.find((item) => (
          Number(item.exercise_submission_count) > 0 || Number(item.quiz_attempt_count) > 0
        )) || loadedCourses.find((item) => Number(item.student_count) > 0) || loadedCourses[0];
        if (preferredCourse) setSelectedCourseId(String(preferredCourse.id));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      return undefined;
    }
    let active = true;
    Promise.all([
      apiRequest(`/instructor/courses/${selectedCourseId}`),
      apiRequest(`/instructor/courses/${selectedCourseId}/students`),
    ])
      .then(([{ course: loadedCourse }, { students: loadedStudents }]) => {
        if (!active) return;
        setCourse(loadedCourse);
        setStudents(loadedStudents);
        setLoadedCourseId(selectedCourseId);
        setFailedCourseId('');
      })
      .catch((requestError) => {
        if (active) {
          setFailedCourseId(selectedCourseId);
          setError(requestError.message);
        }
      })
    return () => {
      active = false;
    };
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return undefined;
    let active = true;
    let refreshing = false;
    const refreshCertificateRequests = async () => {
      if (!active || refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const { students: updatedStudents } = await apiRequest(`/instructor/courses/${selectedCourseId}/students`);
        if (active) setStudents(updatedStudents);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        refreshing = false;
      }
    };
    const intervalId = window.setInterval(refreshCertificateRequests, 5000);
    window.addEventListener('focus', refreshCertificateRequests);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshCertificateRequests);
    };
  }, [selectedCourseId]);

  async function createCourse(event) {
    event.preventDefault();
    await perform(async () => {
      const { course: createdCourse } = await apiRequest('/instructor/courses', {
        method: 'POST',
        body: courseForm,
      });
      setCourseForm(initialCourseForm);
      await refreshCourses();
      setSelectedCourseId(createdCourse.id);
    }, 'Draft course created. Add lessons when you are ready.');
  }

  async function addStarterCourses() {
    if (!window.confirm('Remove the current HTML & CSS, JavaScript, Python, PHP, MySQL, and Data Structures course versions and add six new complete courses? Old versions with enrolled students will be archived so their progress and submissions remain available.')) return;
    await perform(async () => {
      const { courses: createdCourses, message } = await apiRequest('/instructor/starter-courses', { method: 'POST' });
      await refreshCourses();
      if (createdCourses[0]) setSelectedCourseId(createdCourses[0].id);
      setNotice(message);
    }, '');
  }

  async function refreshAfterChange() {
    await Promise.all([refreshCourses(), refreshCourse()]);
  }

  async function removeCourse(courseId) {
    if (!window.confirm('Delete this course permanently? Courses with enrollment history cannot be deleted.')) return;
    await perform(async () => {
      await apiRequest(`/instructor/courses/${courseId}`, { method: 'DELETE' });
      const remaining = await refreshCourses();
      setSelectedCourseId(remaining[0] ? String(remaining[0].id) : '');
      setCourse(null);
      setLoadedCourseId('');
    }, 'Course deleted.');
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/">
          <span className="brand-mark"><Code2 size={19} strokeWidth={2.5} /></span>
          <span>codebloom<span className="brand-period">.</span></span>
        </Link>
        <div className="sidebar-label">TEACHING SPACE</div>
        <nav className="dashboard-nav" aria-label="Instructor navigation">
          <a className="dashboard-nav-item selected" href="#instructor-overview"><LayoutDashboard size={18} /> Overview</a>
          <a className="dashboard-nav-item" href="#instructor-courses"><BookOpen size={18} /> Courses</a>
          <a className="dashboard-nav-item" href="#instructor-content"><FileText size={18} /> Lessons and materials</a>
          <a className="dashboard-nav-item" href="#instructor-quizzes"><Check size={18} /> Exercises and quizzes</a>
          <a className="dashboard-nav-item" href="#instructor-students"><Users size={18} /> Students and performance{courses.reduce((count, item) => count + (item.pending_certificate_count || 0), 0) > 0 && <span className="certificate-request-badge">{courses.reduce((count, item) => count + (item.pending_certificate_count || 0), 0)}</span>}</a>
        </nav>
        <div className="sidebar-promo">
          <div className="promo-icon"><GraduationCap size={19} /></div>
          <strong>Your teaching space</strong>
          <p>Build courses, share practice, and support learner growth.</p>
        </div>
        <div className="sidebar-bottom">
          <a className="dashboard-nav-item" href="#instructor-settings"><Settings size={18} /> Settings</a>
          <button className="dashboard-nav-item dashboard-nav-button" type="button" onClick={onLogout} disabled={isLoggingOut}>
            <LogOut size={18} /> {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
          <div className="profile-mini">
            <span className="profile-avatar">{initials}</span>
            <span><strong>{user.fullName}</strong><small>Instructor</small></span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb">Teaching space <ChevronRight size={14} /> <strong>Overview</strong></div>
          <div className="topbar-actions"><span className="profile-avatar top-avatar">{initials}</span></div>
        </header>
        <main className="dashboard-content instructor-content" id="instructor-overview">
          <section className="welcome-row">
            <div>
              <div className="welcome-date">{today}</div>
              <h1>Welcome, {user.fullName.split(/\s+/)[0]}</h1>
              <p>Create courses, develop lessons, and track your students’ progress.</p>
            </div>
          </section>

          {(error || notice) && (
            <p className={error ? 'instructor-feedback auth-error' : 'instructor-feedback auth-success'} role={error ? 'alert' : 'status'}>
              {error || notice}
            </p>
          )}

          <section className="instructor-panel" id="instructor-courses">
            <div className="instructor-panel-heading">
              <div><h2>Your courses</h2><p>Select a course to continue editing, or start a new one below.</p></div>
              <div className="instructor-course-actions">
                <span className="instructor-count">{courses.length} {courses.length === 1 ? 'course' : 'courses'}</span>
                <button className="button button-outline instructor-submit" type="button" onClick={addStarterCourses} disabled={busy}>Replace with six new courses</button>
              </div>
            </div>
            <p className="instructor-template-note">HTML &amp; CSS, JavaScript, Python, PHP, MySQL, and Data Structures.</p>
            {loadingCourses ? <p className="instructor-muted">Loading courses…</p> : (
              <div className="instructor-course-list">
                {!!courses.length && <p className="instructor-help-copy">To continue working on a course, click its row. “Draft” means it is only visible here; “Published” means students can find it.</p>}
                {courses.map((item) => (
                  <button
                    className={`instructor-course-option${String(item.id) === selectedCourseId ? ' active' : ''}`}
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedCourseId(String(item.id))}
                  >
                    <span><strong>{item.title}</strong><small>{item.module_count} modules · {item.lesson_count} lessons</small><small>{item.student_count} enrolled · {item.exercise_submission_count} exercise submissions · {item.quiz_attempt_count} quiz attempts</small></span>
                    <span className={`course-status-badge status-${item.status}`}>{item.status}</span>
                  </button>
                ))}
                {!courses.length && <p className="instructor-muted">No courses yet. Start with the short form below.</p>}
              </div>
            )}

            <form className="instructor-form create-course-form" id="create-instructor-course" onSubmit={createCourse}>
              <h3><Plus size={16} /> Create a course</h3>
              <p className="instructor-help-copy">Start with a draft. You can add or change any content later.</p>
              <div className="instructor-form-grid">
                <label>Course title<input required maxLength="180" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></label>
                <label>Difficulty
                  <select value={courseForm.difficulty} onChange={(event) => setCourseForm({ ...courseForm, difficulty: event.target.value })}>
                    <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                  </select>
                </label>
                <label className="instructor-form-wide">Description<textarea required maxLength="10000" rows="3" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></label>
                <label>Estimated time (minutes)<input type="number" min="0" max="100000" value={courseForm.estimatedMinutes} onChange={(event) => setCourseForm({ ...courseForm, estimatedMinutes: Number(event.target.value) })} /></label>
              </div>
              <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Plus size={15} /> {busy ? 'Creating course…' : 'Create draft course'}</button>
            </form>
          </section>

          {loadingCourse && <p className="instructor-muted">Loading selected course…</p>}
          {activeCourse && (
            <>
              <CourseEditor
                key={activeCourse.id}
                course={activeCourse}
                busy={busy}
                perform={perform}
                refresh={refreshAfterChange}
                onDelete={removeCourse}
              />
              <section className="instructor-panel" id="instructor-content">
                <div className="instructor-panel-heading">
                  <div><h2>Modules, lessons, and materials</h2><p>First add a module (a course section); then add one or more lessons inside it. Each lesson can include an explanation, code, files, and exercises.</p></div>
                </div>
                <ModuleCreator course={activeCourse} busy={busy} perform={perform} refresh={refreshAfterChange} />
                {activeCourse.modules.map((module) => (
                  <ModuleEditor key={module.id} module={module} busy={busy} perform={perform} refresh={refreshAfterChange} />
                ))}
                {!activeCourse.modules.length && <p className="instructor-muted">Start here: add your first module above. Once it appears, you can add lessons inside that module.</p>}
              </section>

              <section className="instructor-panel" id="instructor-quizzes">
                <div className="instructor-panel-heading">
                  <div><h2>Quizzes</h2><p>Create a multiple-choice quiz for this course. Students see it after the course is published and they enroll.</p></div>
                </div>
                <QuizCreator courseId={activeCourse.id} quizzes={activeCourse.quizzes} busy={busy} perform={perform} refresh={refreshAfterChange} />
              </section>

              <section className="instructor-panel" id="instructor-students">
                <div className="instructor-panel-heading">
                  <div><h2>Student enrollment and performance</h2><p>Review submitted work and approve or decline certificate requests. New requests appear here automatically.</p></div>
                  <span className="instructor-count">{students.filter((student) => student.certificate_status === 'pending_instructor').length} certificate requests · {students.length} enrolled</span>
                </div>
                {students.length ? (
                  <div className="instructor-table-wrap">
                    <table className="instructor-table">
                      <thead><tr><th>Student</th><th>Status</th><th>Lessons complete</th><th>Exercises submitted</th><th>Average quiz score</th><th>Enrolled</th><th>Submitted work</th><th>Certificate review</th></tr></thead>
                      <tbody>{students.map((student) => (
                        <Fragment key={student.id}>
                          <tr>
                            <td><strong>{student.full_name}</strong><small>{student.email}</small></td>
                            <td>{student.status}</td>
                            <td>{student.completed_lessons} / {student.total_lessons}</td>
                            <td>{student.exercise_submissions}</td>
                            <td>{student.average_quiz_score === null ? '—' : `${student.average_quiz_score.toFixed(1)}%`}</td>
                            <td>{new Date(student.enrolled_at).toLocaleDateString()}</td>
                            <td><button className="instructor-archive-button" type="button" aria-expanded={expandedStudentId === student.id} onClick={() => setExpandedStudentId((current) => current === student.id ? '' : student.id)}>{expandedStudentId === student.id ? 'Hide work' : 'View work'}</button></td>
                            <td>
                              {student.certificate_status === 'pending_instructor' ? (
                                <div className="certificate-review-actions">
                                  <button className="button button-small" type="button" disabled={busy} onClick={() => perform(async () => {
                                    await apiRequest(`/instructor/certificates/${student.certificate_id}`, { method: 'PATCH', body: { decision: 'approve' } });
                                    await refreshCourse();
                                  }, 'Request forwarded to the administrator.')}>Approve</button>
                                  <button className="instructor-archive-button" type="button" disabled={busy} onClick={() => perform(async () => {
                                    await apiRequest(`/instructor/certificates/${student.certificate_id}`, { method: 'PATCH', body: { decision: 'decline' } });
                                    await refreshCourse();
                                  }, 'Certificate request declined.')}>Decline</button>
                                </div>
                              ) : student.certificate_status === 'pending_admin' ? 'Waiting for admin'
                                : student.certificate_status === 'issued' ? 'Issued'
                                  : student.certificate_status?.startsWith('declined') ? 'Declined'
                                    : '—'}
                            </td>
                          </tr>
                          {expandedStudentId === student.id && (
                            <tr><td className="student-work-expanded" colSpan={8}><StudentSubmissionDetails courseId={activeCourse.id} studentId={student.id} /></td></tr>
                          )}
                        </Fragment>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="instructor-muted">{course.status === 'published' ? 'No students have enrolled yet. Students can find this course in Explore and enroll to start learning.' : 'This course is a draft. Publish it first; then students can find it in Explore and enroll.'}</p>}
              </section>
            </>
          )}
          <span id="instructor-settings" />
        </main>
      </div>
    </div>
  );
}

function StudentSubmissionDetails({ courseId, studentId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const loadDetails = useCallback(async (isActive = () => true) => {
    try {
      const response = await apiRequest(`/instructor/courses/${courseId}/students/${studentId}/submissions`);
      if (isActive()) {
        setResult(response);
        setError('');
      }
    } catch (requestError) {
      if (isActive()) setError(requestError.message);
    }
  }, [courseId, studentId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => loadDetails(() => active));
    return () => {
      active = false;
    };
  }, [loadDetails, retry]);

  if (error) {
    return <div className="student-work-panel"><p className="auth-error" role="alert">{error}</p><button className="instructor-archive-button" type="button" onClick={() => { setError(''); setRetry((current) => current + 1); }}>Try again</button></div>;
  }
  if (!result) return <p className="instructor-muted" role="status">Loading submitted work…</p>;

  return (
    <div className="student-work-panel">
      <h3>Exercise submissions</h3>
      {result.exercise_submissions.length ? (
        <div className="student-work-list">
          {result.exercise_submissions.map((submission) => (
            <ExerciseSubmissionReview key={submission.id} submission={submission} onSaved={loadDetails} />
          ))}
        </div>
      ) : <p className="instructor-muted">No exercise submissions yet.</p>}

      <h3>Quiz attempts</h3>
      {result.quiz_attempts.length ? (
        <div className="student-work-list">
          {result.quiz_attempts.map((attempt) => (
            <article className="student-work-item" key={attempt.id}>
              <h4>{attempt.quiz_title} · Attempt {attempt.attempt_number}</h4>
              <p>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'Not submitted'} · {attempt.status}{attempt.score !== null ? ` · ${attempt.score}%` : ''}{attempt.passed !== null ? (attempt.passed ? ' · Passed' : ' · Not passed') : ''}</p>
              {attempt.answers.map((answer, index) => (
                <div className="student-quiz-answer" key={answer.question_id}>
                  <strong>{index + 1}. {answer.prompt}</strong>
                  <p>{answer.selected_option || answer.answer_text || 'No answer submitted'}{answer.is_correct !== null ? (answer.is_correct ? ' · Correct' : ' · Incorrect') : ''} · {answer.awarded_points} / {answer.possible_points} points</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : <p className="instructor-muted">No quiz attempts yet.</p>}
    </div>
  );
}

function ExerciseSubmissionReview({ submission, onSaved }) {
  const [status, setStatus] = useState(submission.status);
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function saveGrade(nextStatus) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { message } = await apiRequest(`/instructor/exercise-submissions/${submission.id}`, {
        method: 'PATCH',
        body: { status: nextStatus, feedback },
      });
      setStatus(nextStatus);
      setNotice(message);
      await onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="student-work-item">
      <h4>{submission.exercise_title}</h4>
      <p>{submission.lesson_title} · {new Date(submission.submitted_at).toLocaleString()} · {status === 'passed' ? 'Correct' : status === 'needs_work' ? 'Needs work' : 'Awaiting review'}{submission.score !== null ? ` · ${submission.score}%` : ''}</p>
      {submission.answer_text && <SubmissionCode label="Student response" value={submission.answer_text} />}
      {submission.submitted_html && <SubmissionCode label="HTML" value={submission.submitted_html} />}
      {submission.submitted_css && <SubmissionCode label="CSS" value={submission.submitted_css} />}
      {submission.submitted_javascript && <SubmissionCode label="JavaScript" value={submission.submitted_javascript} />}
      <label className="student-review-feedback">Feedback for student<textarea maxLength={5000} rows="3" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Add feedback or suggestions (optional)." /></label>
      <div className="student-review-actions">
        <button className="button button-small button-dark" type="button" disabled={busy} onClick={() => saveGrade('passed')}>{busy ? 'Saving…' : 'Mark correct'}</button>
        <button className="button button-small button-outline" type="button" disabled={busy} onClick={() => saveGrade('needs_work')}>{busy ? 'Saving…' : 'Mark needs work'}</button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-success" role="status">{notice}</p>}
      {submission.feedback && <p className="student-review-existing-feedback">Previous feedback: {submission.feedback}</p>}
    </article>
  );
}

function SubmissionCode({ label, value }) {
  return <div className="student-submission-code"><strong>{label}</strong><pre>{value}</pre></div>;
}

function CourseEditor({ course, busy, perform, refresh, onDelete }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [difficulty, setDifficulty] = useState(course.difficulty);
  const [estimatedMinutes, setEstimatedMinutes] = useState(course.estimated_minutes);

  async function saveCourse(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/courses/${course.id}`, {
        method: 'PATCH',
        body: { title, description, difficulty, estimatedMinutes },
      });
      await refresh();
    }, 'Course details saved.');
  }

  async function changeStatus(status) {
    if (status !== 'published' && !window.confirm(`Move this course to ${status}? Students may lose access while it is unpublished.`)) return;
    await perform(async () => {
      await apiRequest(`/instructor/courses/${course.id}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await refresh();
    }, status === 'published' ? 'Course published.' : `Course moved to ${status}.`);
  }

  return (
    <section className="instructor-panel">
      <div className="instructor-panel-heading">
        <div><h2>Manage course</h2><p>Update details or change its publication status.</p></div>
        <span className={`course-status-badge status-${course.status}`}>{course.status}</span>
      </div>
      <form className="instructor-form" onSubmit={saveCourse}>
        <div className="instructor-form-grid">
          <label>Course title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="instructor-form-wide">Description<textarea required maxLength="10000" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Estimated time (minutes)<input type="number" min="0" max="100000" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value))} /></label>
        </div>
        <div className="instructor-form-actions">
          <button className="button button-dark instructor-submit" type="submit" disabled={busy}>Save course details</button>
          {course.status !== 'published' && (
            <button className="button button-outline instructor-submit" type="button" onClick={() => changeStatus('published')} disabled={busy || !course.modules.some((module) => module.lessons.length)}>
              Publish course <ArrowUpRight size={15} />
            </button>
          )}
          {course.status === 'published' && (
            <button className="button button-outline instructor-submit" type="button" onClick={() => changeStatus('draft')} disabled={busy}>Unpublish to draft</button>
          )}
          {course.status !== 'archived' && (
            <button className="instructor-archive-button" type="button" onClick={() => changeStatus('archived')} disabled={busy}>Archive</button>
          )}
          <button className="instructor-archive-button" type="button" onClick={() => onDelete(course.id)} disabled={busy}><Trash2 size={14} /> Delete course</button>
        </div>
        {course.status !== 'published' && !course.modules.some((module) => module.lessons.length) && (
          <p className="instructor-field-hint">Add at least one lesson before publishing.</p>
        )}
      </form>
    </section>
  );
}

function ModuleCreator({ course, busy, perform, refresh }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function addModule(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/courses/${course.id}/modules`, { method: 'POST', body: { title, description } });
      setTitle('');
      setDescription('');
      await refresh();
    }, 'Module added.');
  }

  return (
    <form className="instructor-form compact-instructor-form" onSubmit={addModule}>
      <h3><Plus size={16} /> Add module</h3>
      <div className="instructor-form-grid">
        <label>Module title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Module description<input maxLength="5000" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Plus size={15} /> Add module</button>
    </form>
  );
}

function ModuleEditor({ module, busy, perform, refresh }) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [moduleTitle, setModuleTitle] = useState(module.title);
  const [moduleDescription, setModuleDescription] = useState(module.description || '');

  async function saveModule(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/modules/${module.id}`, { method: 'PATCH', body: { title: moduleTitle, description: moduleDescription } });
      setEditing(false);
      await refresh();
    }, 'Module updated.');
  }

  async function removeModule() {
    if (!window.confirm('Delete this module and its lessons? Student history prevents deletion.')) return;
    await perform(async () => {
      await apiRequest(`/instructor/modules/${module.id}`, { method: 'DELETE' });
      await refresh();
    }, 'Module deleted.');
  }
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [codeExample, setCodeExample] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);

  async function addLesson(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/modules/${module.id}/lessons`, {
        method: 'POST',
        body: { title, content, codeExample, estimatedMinutes },
      });
      setTitle('');
      setContent('');
      setCodeExample('');
      setEstimatedMinutes(0);
      await refresh();
    }, 'Lesson added to module.');
  }

  return (
    <article className="instructor-module">
      <button className="instructor-module-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><BookOpen size={16} /> <span>{module.title}</span><span className="instructor-count">{module.lessons.length} lessons</span><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      {expanded && <>
      <div className="instructor-form-actions"><button className="instructor-archive-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edit' : 'Edit module'}</button><button className="instructor-archive-button" type="button" onClick={removeModule} disabled={busy}>Delete module</button></div>
      {editing && <form className="instructor-form compact-instructor-form" onSubmit={saveModule}><div className="instructor-form-grid"><label>Module title<input required maxLength="180" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} /></label><label>Description<input maxLength="5000" value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} /></label></div><button className="button button-outline instructor-submit" type="submit" disabled={busy}>Save module</button></form>}
      {module.description && <p className="instructor-muted">{module.description}</p>}
      <form className="instructor-form compact-instructor-form" onSubmit={addLesson}>
        <h4><Plus size={15} /> Add lesson</h4>
        <div className="instructor-form-grid">
          <label>Lesson title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Estimated time (minutes)<input type="number" min="0" max="65535" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value))} /></label>
          <label className="instructor-form-wide">Explanation<textarea required maxLength="100000" rows="4" value={content} onChange={(event) => setContent(event.target.value)} /></label>
          <label className="instructor-form-wide">Code example<textarea maxLength="50000" rows="4" value={codeExample} onChange={(event) => setCodeExample(event.target.value)} placeholder="Paste an HTML, CSS, or JavaScript example…" /></label>
        </div>
        <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Plus size={15} /> Add lesson</button>
      </form>
      {module.lessons.map((lesson) => (
        <LessonTools key={lesson.id} lesson={lesson} busy={busy} perform={perform} refresh={refresh} />
      ))}
      {!module.lessons.length && <p className="instructor-muted">No lessons in this module yet.</p>}
      </>}
    </article>
  );
}

function LessonTools({ lesson, busy, perform, refresh }) {
  const [editingLesson, setEditingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState(lesson.title);
  const [lessonContent, setLessonContent] = useState(lesson.content);
  const [lessonCode, setLessonCode] = useState(lesson.code_example || '');
  const [lessonMinutes, setLessonMinutes] = useState(lesson.estimated_minutes);
  const [exerciseTitle, setExerciseTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [exerciseType, setExerciseType] = useState('code');
  const [starterHtml, setStarterHtml] = useState('');
  const [starterCss, setStarterCss] = useState('');
  const [starterJavascript, setStarterJavascript] = useState('');
  const [file, setFile] = useState(null);

  async function saveLesson(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/lessons/${lesson.id}`, { method: 'PATCH', body: { title: lessonTitle, content: lessonContent, codeExample: lessonCode, estimatedMinutes: lessonMinutes } });
      setEditingLesson(false);
      await refresh();
    }, 'Lesson updated.');
  }

  async function removeLesson() {
    if (!window.confirm('Delete this lesson? Student progress or submissions prevent deletion.')) return;
    await perform(async () => {
      await apiRequest(`/instructor/lessons/${lesson.id}`, { method: 'DELETE' });
      await refresh();
    }, 'Lesson deleted.');
  }

  async function addExercise(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/lessons/${lesson.id}/exercises`, {
        method: 'POST',
        body: { title: exerciseTitle, instructions, exerciseType, starterHtml, starterCss, starterJavascript },
      });
      setExerciseTitle('');
      setInstructions('');
      setStarterHtml('');
      setStarterCss('');
      setStarterJavascript('');
      await refresh();
    }, 'Practical exercise added.');
  }

  async function uploadMaterial(event) {
    event.preventDefault();
    if (!file) return;
    await perform(async () => {
      const data = new FormData();
      data.append('material', file);
      await apiRequest(`/instructor/lessons/${lesson.id}/materials`, { method: 'POST', body: data });
      setFile(null);
      event.target.reset();
      await refresh();
    }, 'Learning material uploaded.');
  }

  return (
    <div className="instructor-lesson-tools">
      <div className="instructor-lesson-heading">
        <div><h4>{lesson.title}</h4><p>{lesson.estimated_minutes} min · {lesson.exercises.length} exercises · {lesson.materials.length} materials</p></div>
        <div className="instructor-form-actions"><button type="button" className="instructor-archive-button" onClick={() => setEditingLesson((value) => !value)}>{editingLesson ? 'Cancel' : 'Edit lesson'}</button><button type="button" className="instructor-archive-button" onClick={removeLesson} disabled={busy}>Delete lesson</button></div>
      </div>
      {editingLesson && <form className="instructor-form compact-instructor-form" onSubmit={saveLesson}><div className="instructor-form-grid"><label>Lesson title<input required maxLength="180" value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} /></label><label>Estimated time (minutes)<input type="number" min="0" max="65535" value={lessonMinutes} onChange={(event) => setLessonMinutes(Number(event.target.value))} /></label><label className="instructor-form-wide">Explanation<textarea required maxLength="100000" rows="5" value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} /></label><label className="instructor-form-wide">Code example<textarea maxLength="50000" rows="6" value={lessonCode} onChange={(event) => setLessonCode(event.target.value)} /></label></div><button className="button button-dark instructor-submit" type="submit" disabled={busy}>Save lesson</button></form>}
      {lesson.code_example && <pre className="instructor-code-example"><code>{lesson.code_example}</code></pre>}
      <div className="instructor-materials">
        {lesson.materials.map((material) => (
          <span className="instructor-material-item" key={material.id}><a href={`${apiOrigin}${material.url}`} target="_blank" rel="noreferrer"><FileText size={14} /> {material.original_name}</a><button type="button" aria-label={`Delete ${material.original_name}`} onClick={async () => {
            if (!window.confirm(`Delete learning material “${material.original_name}”?`)) return;
            await perform(async () => { await apiRequest(`/instructor/materials/${material.id}`, { method: 'DELETE' }); await refresh(); }, 'Learning material deleted.');
          }} disabled={busy}>Delete</button></span>
        ))}
      </div>
      {lesson.exercises.map((exercise) => (
        <ExerciseEditor key={exercise.id} exercise={exercise} busy={busy} perform={perform} refresh={refresh} />
      ))}
      <div className="instructor-lesson-actions">
        <form className="instructor-form compact-instructor-form" onSubmit={uploadMaterial}>
          <h5>Upload learning material <span>PDF, TXT, MD, ZIP, PNG, or JPEG · 10 MB max</span></h5>
          <div className="instructor-upload-row">
            <input
              type="file"
              accept=".pdf,.txt,.md,.zip,.png,.jpg,.jpeg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button className="button button-outline instructor-submit" type="submit" disabled={busy || !file}>Upload file</button>
          </div>
        </form>
        <form className="instructor-form compact-instructor-form" onSubmit={addExercise}>
          <h5>Add practical exercise</h5>
          <div className="instructor-form-grid">
            <label>Exercise title<input required maxLength="180" value={exerciseTitle} onChange={(event) => setExerciseTitle(event.target.value)} /></label>
            <label>Exercise type
              <select value={exerciseType} onChange={(event) => setExerciseType(event.target.value)}>
                <option value="code">Code</option><option value="multiple_choice">Multiple choice</option><option value="short_answer">Short answer</option>
              </select>
            </label>
            <label className="instructor-form-wide">Instructions<textarea required maxLength="10000" rows="3" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
            {exerciseType === 'code' && (
              <>
                <label>Starter HTML<textarea maxLength="50000" rows="3" value={starterHtml} onChange={(event) => setStarterHtml(event.target.value)} /></label>
                <label>Starter CSS<textarea maxLength="50000" rows="3" value={starterCss} onChange={(event) => setStarterCss(event.target.value)} /></label>
                <label className="instructor-form-wide">Starter JavaScript<textarea maxLength="50000" rows="3" value={starterJavascript} onChange={(event) => setStarterJavascript(event.target.value)} /></label>
              </>
            )}
          </div>
          <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Plus size={15} /> Add exercise</button>
        </form>
      </div>
    </div>
  );
}

function ExerciseEditor({ exercise, busy, perform, refresh }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(exercise.title);
  const [instructions, setInstructions] = useState(exercise.instructions);
  const [exerciseType, setExerciseType] = useState(exercise.exercise_type);
  const [starterHtml, setStarterHtml] = useState(exercise.starter_html || '');
  const [starterCss, setStarterCss] = useState(exercise.starter_css || '');
  const [starterJavascript, setStarterJavascript] = useState(exercise.starter_javascript || '');

  async function save(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/exercises/${exercise.id}`, { method: 'PATCH', body: { title, instructions, exerciseType, starterHtml, starterCss, starterJavascript } });
      setEditing(false);
      await refresh();
    }, 'Exercise updated.');
  }

  async function remove() {
    if (!window.confirm('Delete this exercise? Exercises with student submissions cannot be deleted.')) return;
    await perform(async () => { await apiRequest(`/instructor/exercises/${exercise.id}`, { method: 'DELETE' }); await refresh(); }, 'Exercise deleted.');
  }

  return <div className="instructor-existing-exercise"><div className="instructor-form-actions"><strong>{exercise.title}</strong><span>{exercise.exercise_type}</span><button type="button" className="instructor-archive-button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel' : 'Edit'}</button><button type="button" className="instructor-archive-button" onClick={remove} disabled={busy}>Delete</button></div><p>{exercise.instructions}</p>{editing && <form className="instructor-form compact-instructor-form" onSubmit={save}><div className="instructor-form-grid"><label>Exercise title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Type<select value={exerciseType} onChange={(event) => setExerciseType(event.target.value)}><option value="code">Code</option><option value="multiple_choice">Multiple choice</option><option value="short_answer">Short answer</option></select></label><label className="instructor-form-wide">Instructions<textarea required maxLength="10000" rows="3" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>{exerciseType === 'code' && <><label>Starter HTML<textarea rows="3" value={starterHtml} onChange={(event) => setStarterHtml(event.target.value)} /></label><label>Starter CSS<textarea rows="3" value={starterCss} onChange={(event) => setStarterCss(event.target.value)} /></label><label className="instructor-form-wide">Starter JavaScript<textarea rows="3" value={starterJavascript} onChange={(event) => setStarterJavascript(event.target.value)} /></label></>}</div><button className="button button-outline instructor-submit" type="submit" disabled={busy}>Save exercise</button></form>}</div>;
}

function QuizCreator({ courseId, quizzes, busy, perform, refresh }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [passPercentage, setPassPercentage] = useState(70);
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);

  async function addQuiz(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/courses/${courseId}/quizzes`, {
        method: 'POST',
        body: {
          title, description, question, passPercentage,
          options: options.filter((option) => option.trim()),
          correctOption,
        },
      });
      setTitle('');
      setDescription('');
      setQuestion('');
      setPassPercentage(70);
      setOptions(['', '', '', '']);
      setCorrectOption(0);
      await refresh();
    }, 'Quiz created with its first question.');
  }

  return (
    <>
      {quizzes.length > 0 && (
        <div className="instructor-quiz-list">
          {quizzes.map((quiz) => (
            <QuizEditor key={quiz.id} quiz={quiz} busy={busy} perform={perform} refresh={refresh} />
          ))}
        </div>
      )}
      <form className="instructor-form" onSubmit={addQuiz}>
        <h3><Plus size={16} /> Create quiz</h3>
        <div className="instructor-form-grid">
          <label>Quiz title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Passing score (%)<input type="number" min="0" max="100" value={passPercentage} onChange={(event) => setPassPercentage(Number(event.target.value))} /></label>
          <label className="instructor-form-wide">Quiz description<textarea maxLength="5000" rows="2" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="instructor-form-wide">First question<textarea required maxLength="2000" rows="2" value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
          {options.map((option, index) => (
            <label key={index}>
              Answer option {index + 1}
              <span className="instructor-correct-option">
                <input
                  type="radio"
                  name={`correct-option-${courseId}`}
                  checked={correctOption === index}
                  onChange={() => setCorrectOption(index)}
                  aria-label={`Set option ${index + 1} as correct`}
                />
                <input
                  required
                  maxLength="500"
                  value={option}
                  onChange={(event) => setOptions(options.map((existing, optionIndex) => optionIndex === index ? event.target.value : existing))}
                />
              </span>
            </label>
          ))}
        </div>
        <p className="instructor-field-hint">Select the radio button beside the correct answer.</p>
        <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Plus size={15} /> Create quiz</button>
      </form>
    </>
  );
}

function QuizEditor({ quiz, busy, perform, refresh }) {
  // Older backend instances return quiz metadata without the nested questions
  // array. Keep the dashboard renderable while the API server is restarted.
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [passPercentage, setPassPercentage] = useState(Number(quiz.pass_percentage));
  const [isPublished, setIsPublished] = useState(Boolean(quiz.is_published));

  async function saveQuiz(event) {
    event.preventDefault();
    await perform(async () => {
      await apiRequest(`/instructor/quizzes/${quiz.id}`, { method: 'PATCH', body: { title, description, passPercentage, isPublished } });
      await refresh();
    }, 'Quiz settings saved.');
  }

  async function removeQuiz() {
    if (!window.confirm('Delete this quiz? Quizzes with student attempts are kept to preserve results.')) return;
    await perform(async () => { await apiRequest(`/instructor/quizzes/${quiz.id}`, { method: 'DELETE' }); await refresh(); }, 'Quiz deleted.');
  }

  return <details className="instructor-quiz-item"><summary><strong>{quiz.title}</strong><span>{quiz.question_count ?? questions.length} questions · pass mark {quiz.pass_percentage}%</span></summary><div className="instructor-quiz-editor">
    <form className="instructor-form compact-instructor-form" onSubmit={saveQuiz}><div className="instructor-form-grid"><label>Quiz title<input required maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Passing score (%)<input type="number" min="0" max="100" value={passPercentage} onChange={(event) => setPassPercentage(Number(event.target.value))} /></label><label className="instructor-form-wide">Description<textarea rows="2" maxLength="5000" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="instructor-checkbox-label"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} /> Available to students after course publication</label></div><div className="instructor-form-actions"><button className="button button-outline instructor-submit" type="submit" disabled={busy}>Save quiz</button><button className="instructor-archive-button" type="button" onClick={removeQuiz} disabled={busy}>Delete quiz</button></div></form>
    <div className="instructor-question-list">{questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} quizId={quiz.id} busy={busy} perform={perform} refresh={refresh} />)}</div>
    <QuestionEditor quizId={quiz.id} index={questions.length} busy={busy} perform={perform} refresh={refresh} />
  </div></details>;
}

function QuestionEditor({ question, index, quizId, busy, perform, refresh }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(question?.prompt || '');
  const [options, setOptions] = useState(question?.options.map((option) => option.text) || ['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(Math.max(0, question?.options.findIndex((option) => option.is_correct) ?? 0));

  function setOption(indexToUpdate, value) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === indexToUpdate ? value : option));
  }

  function removeOption(indexToRemove) {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== indexToRemove));
    setCorrectOption((current) => current === indexToRemove ? 0 : current > indexToRemove ? current - 1 : current);
  }

  async function saveQuestion(event) {
    event.preventDefault();
    await perform(async () => {
      const method = question ? 'PATCH' : 'POST';
      const path = question ? `/instructor/questions/${question.id}` : `/instructor/quizzes/${quizId}/questions`;
      await apiRequest(path, { method, body: { prompt, options, correctOption } });
      if (!question) setOpen(false);
      await refresh();
    }, question ? 'Question saved.' : 'Question added.');
  }

  async function removeQuestion() {
    if (!window.confirm('Delete this question? Student quiz attempts prevent changing quiz content.')) return;
    await perform(async () => { await apiRequest(`/instructor/questions/${question.id}`, { method: 'DELETE' }); await refresh(); }, 'Question deleted.');
  }

  return <details className="instructor-question-editor" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{question ? `Question ${index + 1}: ${question.prompt}` : '＋ Add a question'}</summary><form className="instructor-form compact-instructor-form" onSubmit={saveQuestion}><label>Question<textarea required maxLength="2000" rows="2" value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><div className="instructor-answer-list">{options.map((option, optionIndex) => <label key={optionIndex}>Answer {optionIndex + 1}<span className="instructor-correct-option"><input type="radio" name={`correct-${question?.id ?? quizId}-${index}`} checked={correctOption === optionIndex} onChange={() => setCorrectOption(optionIndex)} aria-label={`Set answer ${optionIndex + 1} as correct`} /><input required maxLength="500" value={option} onChange={(event) => setOption(optionIndex, event.target.value)} /><button type="button" onClick={() => removeOption(optionIndex)} disabled={options.length <= 2} aria-label={`Remove answer ${optionIndex + 1}`}>×</button></span></label>)}</div><div className="instructor-form-actions"><button type="button" className="button button-outline instructor-submit" onClick={() => setOptions((current) => current.length < 6 ? [...current, ''] : current)} disabled={options.length >= 6}>Add answer option</button><button type="submit" className="button button-dark instructor-submit" disabled={busy}>{question ? 'Save question' : 'Add question'}</button>{question && <button type="button" className="instructor-archive-button" onClick={removeQuestion} disabled={busy}>Delete question</button>}</div></form></details>;
}
