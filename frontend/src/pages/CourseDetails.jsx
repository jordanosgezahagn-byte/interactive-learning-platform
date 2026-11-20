import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Clock3, GraduationCap } from 'lucide-react';
import { apiRequest } from '../lib/api';
import ReportContentForm from '../components/ReportContentForm';

function durationLabel(minutes) {
  if (!minutes) return 'Self paced';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest(`/courses/${courseId}`)
      .then(({ course: loadedCourse }) => {
        if (active) setCourse(loadedCourse);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  async function enroll() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/student/courses/${courseId}/enroll`, { method: 'POST' });
      navigate(`/learn/course/${courseId}`);
    } catch (requestError) {
      if (requestError.status === 401) {
        navigate('/login', { state: { from: `/courses/${courseId}` } });
      } else {
        setError(requestError.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="course-details-page">
      <header className="course-details-header">
        <Link className="brand" to="/"><span className="brand-mark"><BookOpen size={18} /></span><span>codebloom<span className="brand-period">.</span></span></Link>
        <Link className="course-details-back" to="/">Explore courses <ArrowLeft size={15} /></Link>
      </header>
      <section className="course-details-card">
        {loading ? <p role="status">Loading course…</p> : error && !course ? <p className="auth-error" role="alert">{error}</p> : course && (
          <>
            <span className="course-details-kicker">{course.difficulty} course</span>
            <h1>{course.title}</h1>
            <p className="course-details-description">{course.description}</p>
            <div className="course-details-meta">
              <span><GraduationCap size={16} /> {course.instructor_name}</span>
              <span><BookOpen size={16} /> {course.lesson_count} lessons</span>
              <span><Clock3 size={16} /> {durationLabel(course.estimated_minutes)}</span>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="button" className="button button-dark course-enroll-button" onClick={enroll} disabled={busy}>
              {busy ? 'Enrolling…' : 'Enroll and start learning'} <ArrowRight size={16} />
            </button>
            <p className="course-details-note">Your lessons, practical exercises, and published quizzes will be available after you enroll.</p>
            <ReportContentForm courseId={courseId} targetType="course" contentTitle={course.title} onSignIn={() => navigate('/login', { state: { from: `/courses/${courseId}` } })} />
          </>
        )}
      </section>
    </main>
  );
}
