import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, Code2, GraduationCap,
  LayoutDashboard, LogOut, Search, Settings,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import InstructorDashboard from './InstructorDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard({ user }) {
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const displayName = user.fullName;
  const firstName = displayName.split(/\s+/)[0];
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  async function handleLogout() {
    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setIsLoggingOut(false);
    }
  }

  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date()).toUpperCase();

  if (user.role === 'instructor') {
    return (
      <InstructorDashboard
        user={user}
        today={today}
        initials={initials}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
      />
    );
  }
  if (user.role === 'admin') {
    return (
      <AdminDashboard
        user={user}
        today={today}
        initials={initials}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
      />
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/"><span className="brand-mark"><Code2 size={19} strokeWidth={2.5} /></span><span>codebloom<span className="brand-period">.</span></span></Link>
        <div className="sidebar-label">LEARNING SPACE</div>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <Link className="dashboard-nav-item selected" to="/student/dashboard"><LayoutDashboard size={18} /> Overview</Link>
          <a className="dashboard-nav-item" href="#my-courses"><BookOpen size={18} /> My courses</a>
        </nav>
        <div className="sidebar-bottom"><a className="dashboard-nav-item" href="#settings"><Settings size={18} /> Settings</a>        <button className="dashboard-nav-item dashboard-nav-button" type="button" onClick={handleLogout} disabled={isLoggingOut}><LogOut size={18} /> {isLoggingOut ? 'Signing out…' : 'Sign out'}</button>{logoutError && <p className="auth-error" role="alert">{logoutError}</p>}<div className="profile-mini"><span className="profile-avatar">{initials}</span><span><strong>{displayName}</strong><small>{user.role}</small></span><ChevronRight size={16} /></div></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumb">Learning space <ChevronRight size={14} /> <strong>Overview</strong></div><div className="topbar-actions"><label className="dashboard-search"><Search size={16} /><input placeholder="Search courses..." aria-label="Search" /></label><span className="profile-avatar top-avatar">{initials}</span></div></header>
        <main className="dashboard-content">
          <section className="welcome-row"><div><div className="welcome-date">{today}</div><h1>Welcome back, {firstName}</h1><p>Keep learning with courses published by your instructors.</p></div><Link className="button button-dark" to="/#courses">Explore courses <ArrowRight size={16} /></Link></section>
          <StudentLearningPanel />
        </main>
      </div>
    </div>
  );
}

function StudentLearningPanel() {
  const [courses, setCourses] = useState([]);
  const [publishedCourses, setPublishedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [certificateMessage, setCertificateMessage] = useState('');
  const [requestingCertificate, setRequestingCertificate] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiRequest('/student/courses'),
      apiRequest('/courses'),
    ])
      .then(([enrolledResult, catalogResult]) => {
        if (!active) return;
        if (enrolledResult.status === 'fulfilled') {
          setCourses(enrolledResult.value.courses);
        } else {
          setError(enrolledResult.reason.message);
        }
        if (catalogResult.status === 'fulfilled') {
          setPublishedCourses(catalogResult.value.courses);
        } else {
          setCatalogError(catalogResult.reason.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const completedLessons = courses.reduce((total, course) => total + course.completed_lessons, 0);
  const enrolledCourseIds = new Set(courses.map((course) => course.id));
  const availableCourses = publishedCourses.filter((course) => !enrolledCourseIds.has(course.id));

  async function requestCertificate(courseId) {
    setRequestingCertificate(courseId);
    setCertificateMessage('');
    try {
      const { certificate, message } = await apiRequest(`/student/courses/${courseId}/certificate-requests`, {
        method: 'POST',
      });
      setCourses((current) => current.map((course) => (
        course.id === courseId
          ? { ...course, certificate_id: certificate.id, certificate_status: certificate.status }
          : course
      )));
      setCertificateMessage(message);
    } catch (requestError) {
      setCertificateMessage(requestError.message);
    } finally {
      setRequestingCertificate('');
    }
  }

  return (
    <>
      <section className="stats-grid" aria-label="Learning statistics">
        <article className="stat-card"><span className="stat-icon stat-mint"><BookOpen size={18} /></span><span className="stat-label">MY COURSES</span><strong>{courses.length}</strong><small>Enrolled courses</small></article>
        <article className="stat-card"><span className="stat-icon stat-lilac"><GraduationCap size={18} /></span><span className="stat-label">LESSONS COMPLETED</span><strong>{completedLessons}</strong><small>Progress saved to your account</small></article>
      </section>
      <section className="my-courses-panel student-course-list" id="my-courses">
        <div className="panel-heading"><div><h2>Your courses</h2><p>Lessons, exercises, and quizzes assigned by your instructors.</p></div><Link to="/#courses" className="text-link">Explore courses <ArrowRight size={15} /></Link></div>
        {loading ? <p className="instructor-muted" role="status">Loading your courses…</p>
          : error ? <p className="auth-error" role="alert">{error}</p>
            : courses.length ? courses.map((course) => {
              const progress = course.lesson_count
                ? Math.min(100, Math.round((course.completed_lessons / course.lesson_count) * 100))
                : 0;
              return (
                <article className="learning-course-row" key={course.id}>
                  <div className="mini-course-art art-mint"><span>〈〉</span></div>
                  <div className="learning-course-details">
                    <div className="course-meta"><span>{course.difficulty.toUpperCase()}</span><span className="meta-dot" />{progress === 100 ? 'COMPLETED' : course.enrollment_status.toUpperCase()}</div>
                    <h3>{course.title}</h3>
                    {course.description && <p>{course.description}</p>}
                    <div className="mini-progress"><span style={{ width: `${progress}%` }} /></div>
                    <div className="mini-progress-caption">{course.completed_lessons} of {course.lesson_count} lessons <span>{progress}%</span></div>
                    <div className="certificate-status">
                      {course.certificate_status === 'issued' ? (
                        <Link className="text-link" to={`/certificates/${course.certificate_code}`}>View and download certificate</Link>
                      ) : course.certificate_status === 'pending_instructor' ? 'Certificate request waiting for instructor review.'
                        : course.certificate_status === 'pending_admin' ? 'Instructor approved your request; it is waiting for final admin review.'
                          : course.certificate_status === 'declined_instructor' || course.certificate_status === 'declined_admin' ? (
                            <>
                              <span>Certificate request declined{course.certificate_status === 'declined_instructor' ? ' by the instructor' : ' by the admin'}{course.certificate_instructor_note || course.certificate_admin_note ? `: ${course.certificate_instructor_note || course.certificate_admin_note}` : '.'}</span>
                              {course.certificate_eligible && <button className="instructor-archive-button" type="button" disabled={requestingCertificate === course.id} onClick={() => requestCertificate(course.id)}>Request again</button>}
                            </>
                          ) : course.certificate_eligible ? (
                            <button className="button button-small" type="button" disabled={requestingCertificate === course.id} onClick={() => requestCertificate(course.id)}>
                              {requestingCertificate === course.id ? 'Requesting…' : 'Request certificate'}
                            </button>
                          ) : <span>Complete all published lessons and pass the course exercises and quizzes to request a certificate.</span>}
                    </div>
                  </div>
                  <Link to={`/learn/course/${course.id}`} className="round-arrow" aria-label={progress === 100 ? `Review ${course.title}` : `Continue ${course.title}`}><ArrowRight size={17} /></Link>
                </article>
              );
            }) : <div className="empty-courses">You have not enrolled in a course yet. Browse published courses to get started.</div>}
      </section>
      {certificateMessage && <p className="certificate-feedback" role="status">{certificateMessage}</p>}
      <section className="my-courses-panel student-course-list" id="available-courses">
        <div className="panel-heading">
          <div><h2>Available courses</h2><p>Browse courses published by your instructors. Select one to view details and enroll.</p></div>
          <Link to="/#courses" className="text-link">Explore all <ArrowRight size={15} /></Link>
        </div>
        {loading ? <p className="instructor-muted" role="status">Finding published courses…</p>
          : catalogError ? <p className="auth-error" role="alert">{catalogError}</p>
            : availableCourses.length ? availableCourses.map((course) => (
              <article className="learning-course-row available-course-row" key={course.id}>
                <div className="mini-course-art art-mint"><span>{course.category.split(',')[0].trim().slice(0, 2).toUpperCase()}</span></div>
                <div className="learning-course-details">
                  <div className="course-meta"><span>{course.difficulty.toUpperCase()}</span><span className="meta-dot" />{course.lesson_count} LESSONS</div>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <small>Instructor: {course.instructor_name}</small>
                </div>
                <Link to={`/courses/${course.id}`} className="button button-outline available-course-link">View and enroll <ArrowRight size={14} /></Link>
              </article>
            )) : <div className="empty-courses">{publishedCourses.length ? 'You are already enrolled in every published course.' : 'There are no published courses yet. Check back later.'}</div>}
      </section>
    </>
  );
}
