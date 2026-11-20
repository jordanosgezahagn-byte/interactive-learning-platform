import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp,
  Code2, Download, FileCode2, GraduationCap, Play, RotateCcw, Send,
} from 'lucide-react';
import { API_URL, apiRequest } from '../lib/api';
import ReportContentForm from '../components/ReportContentForm';

const apiOrigin = API_URL.replace(/\/api\/?$/, '');

function previewDocument(code) {
  const script = code.js
    ? `<script>
      const output = document.createElement('pre');
      output.style.cssText = 'white-space:pre-wrap;overflow:auto;margin:12px;padding:12px;color:#26352b;background:#f6f8f4;font:12px/1.6 monospace';
      document.body.append(output);
      const format = (value) => {
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
      };
      for (const method of ['log', 'info', 'warn', 'error']) {
        console[method] = (...values) => {
          output.textContent += values.map(format).join(' ') + '\\n';
        };
      }
      window.addEventListener('error', (event) => {
        output.textContent += 'Error: ' + event.message + '\\n';
      });
      try {
        ${code.js.replace(/<\/script/gi, '<\\/script')}
      } catch (error) {
        output.textContent += 'Error: ' + error.message + '\\n';
      }
    </script>`
    : '';
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><style>${code.css}</style></head><body>${code.html}${script}</body></html>`;
}

function getEditorSettings(language, codeExample) {
  const courseTitle = language.toLowerCase();
  if (courseTitle.includes('html') || courseTitle.includes('css')) {
    return {
      tabs: ['html', 'css'],
      mode: 'preview',
      initialCode: {
        html: codeExample || '<main>\n  <h1>Start building</h1>\n  <p>Edit this page and make it your own.</p>\n</main>',
        css: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n  color: #234;\n}\n\nh1 {\n  color: #28735f;\n}',
      },
    };
  }
  if (courseTitle.includes('javascript') || courseTitle.includes('data structure')) {
    return {
      tabs: ['js'],
      mode: 'preview',
      initialCode: {
        html: '<main><h1>JavaScript practice</h1><p>Open the browser console to explore your code.</p></main>',
        js: codeExample || 'const greeting = "Hello, world!";\nconsole.log(greeting);',
      },
    };
  }
  if (courseTitle.includes('python')) {
    return { tabs: ['py'], mode: 'python', initialCode: { py: codeExample || 'name = "Learner"\nprint(f"Hello, {name}!")' } };
  }
  if (courseTitle.includes('php')) {
    return { tabs: ['php'], mode: 'php', initialCode: { php: codeExample || '<?php\necho "Hello, world!";' } };
  }
  if (courseTitle.includes('mysql') || courseTitle.includes('sql')) {
    return { tabs: ['sql'], mode: 'mysql', initialCode: { sql: codeExample || "SELECT 'Hello, world!' AS message;" } };
  }
  return {
    tabs: ['html', 'css', 'js'],
    mode: 'preview',
    initialCode: {
      html: '<main>\n  <h1>Start building</h1>\n  <p>Edit the HTML, CSS, or JavaScript to try an idea.</p>\n</main>',
      css: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n}\n\nh1 {\n  color: #28735f;\n}',
      js: codeExample || 'console.log("Hello, world!");',
    },
  };
}

function createCodeRunner(onMessage, onError) {
  const worker = new Worker(new URL('../workers/codeRunner.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onMessage;
  worker.onerror = onError;
  return worker;
}

export default function CourseWorkspace() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const lessons = useMemo(
    () => course?.modules.flatMap((module) => module.lessons) ?? [],
    [course],
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId)
    ?? lessons.find((lesson) => !lesson.is_completed)
    ?? lessons.at(-1);
  const completedLessons = lessons.filter((lesson) => lesson.is_completed).length;
  const allLessonsComplete = lessons.length > 0
    && course?.modules.every((module) => module.lessons.length > 0)
    && completedLessons === lessons.length
    && lessons.every((lesson) => lesson.is_completed);
  const courseComplete = allLessonsComplete
    && lessons.every((lesson) => lesson.exercises.every((exercise) => (
      exercise.submissions?.some((submission) => submission.status === 'passed')
    )))
    && course?.quizzes.every((quiz) => quiz.passed);

  const loadCourse = useCallback(async () => {
    const { course: loadedCourse } = await apiRequest(`/student/courses/${courseId}`, { cache: 'no-store' });
    setCourse(loadedCourse);
    setSelectedLessonId((current) => (
      loadedCourse.modules.flatMap((module) => module.lessons).some((lesson) => lesson.id === current)
        ? current
        : ''
    ));
  }, [courseId]);

  useEffect(() => {
    let active = true;
    apiRequest(`/student/courses/${courseId}`, { cache: 'no-store' })
      .then(({ course: loadedCourse }) => {
        if (!active) return;
        setCourse(loadedCourse);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 401) setUnauthenticated(true);
        else setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (!active || refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const { course: loadedCourse } = await apiRequest(`/student/courses/${courseId}`, { cache: 'no-store' });
        if (!active) return;
        setCourse(loadedCourse);
        setSelectedLessonId((current) => (
          loadedCourse.modules.flatMap((module) => module.lessons).some((lesson) => lesson.id === current)
            ? current
            : ''
        ));
      } catch {
        // Keep the last loaded course visible during transient refresh failures.
      } finally {
        refreshing = false;
      }
    };
    const intervalId = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [courseId]);

  if (unauthenticated) return <Navigate to="/login" replace />;
  if (loading) return <div className="auth-container" role="status">Loading your course…</div>;
  if (error || !course) {
    return (
      <div className="auth-container">
        <p className="auth-error" role="alert">{error || 'Course not found.'}</p>
        <Link to={`/courses/${courseId}`} className="text-link">View the course and enroll</Link>
      </div>
    );
  }
  if (courseComplete) {
    return <CourseCompletionScreen course={course} reloadCourse={loadCourse} />;
  }
  if (!selectedLesson) {
    return (
      <div className="auth-container">
        <p>This course has no published lessons yet.</p>
        <Link to="/student/dashboard" className="text-link">Back to your learning</Link>
      </div>
    );
  }

  return (
    <div className="learning-shell">
      <header className="learning-topbar">
        <div className="learning-top-left">
          <Link to="/" className="workspace-brand"><span className="brand-mark"><Code2 size={18} strokeWidth={2.5} /></span><span>codebloom<span className="brand-period">.</span></span></Link>
          <span className="top-divider" />
          <Link to="/student/dashboard" className="back-course"><ArrowLeft size={15} /> My learning</Link>
        </div>
        <div className="learning-course-title"><span>{course.title}</span><ChevronRight size={14} /><strong>{selectedLesson.title}</strong></div>
        <span className="profile-avatar top-avatar"><GraduationCap size={15} /></span>
      </header>
      <div className="workspace-layout">
        <aside className="lesson-sidebar">
          <Link to="/student/dashboard" className="sidebar-back"><ArrowLeft size={16} /> My courses</Link>
          <div className="lesson-course-heading"><span className="lesson-course-icon">〈〉</span><div><strong>{course.title}</strong><small>{course.difficulty}</small></div></div>
          <div className="lesson-course-progress">
            <div className="lesson-progress-track"><span style={{ width: `${lessons.length ? (completedLessons / lessons.length) * 100 : 0}%` }} /></div>
            <span>{completedLessons} of {lessons.length} lessons</span>
          </div>
          {course.modules.map((module, index) => (
            <section className="course-workspace-module" key={module.id}>
              <div className="module-heading"><span>MODULE {index + 1} · {module.lesson_count} {module.lesson_count === 1 ? 'LESSON' : 'LESSONS'}</span><ChevronRight size={14} /></div>
              <h2 className="module-title">{module.title}</h2>
              <nav className="lesson-list" aria-label={`${module.title} lessons`}>
                {module.lessons.map((lesson) => (
                  <button
                    className={`lesson-item${selectedLesson.id === lesson.id ? ' lesson-active' : ''}${lesson.is_completed ? ' lesson-done' : ''}`}
                    type="button"
                    key={lesson.id}
                    onClick={() => setSelectedLessonId(lesson.id)}
                  >
                    <span className="lesson-status">{lesson.is_completed ? <Check size={13} /> : <Play size={10} />}</span>
                    <span>{lesson.title}</span>
                  </button>
                ))}
              </nav>
            </section>
          ))}
          <div className="sidebar-help"><CircleHelp size={17} /><span>Course by<small>{course.instructor_name}</small></span></div>
        </aside>
        <main className="lesson-content">
          <LessonView
            key={selectedLesson.id}
            lesson={selectedLesson}
            quizzes={course.quizzes}
            language={course.title}
            courseId={courseId}
            course={course}
            showQuizzes={selectedLesson.id === lessons[lessons.length - 1]?.id}
            reload={loadCourse}
          />
        </main>
      </div>
    </div>
  );
}

function CertificateAction({ course, reload }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lessons = course.modules.flatMap((module) => module.lessons);
  const allLessons = lessons.length > 0
    && course.modules.every((module) => module.lessons.length > 0)
    && lessons.every((lesson) => lesson.is_completed);
  const eligible = allLessons;
  const certificate = course.certificate;

  async function requestCertificate() {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiRequest(`/student/courses/${course.id}/certificate-requests`, { method: 'POST' });
      setMessage(result.message);
      await reload();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="certificate-course-action" aria-label="Certificate request">
      <div className="certificate-course-action-heading">
        <strong>Course certificate</strong>
        <span>Instructor review followed by admin approval</span>
      </div>
      {certificate?.status === 'issued' ? (
        <Link className="button button-dark" to={`/certificates/${certificate.code}`}>View and download certificate <ArrowRight size={15} /></Link>
      ) : certificate?.status === 'pending_instructor' ? (
        <p>Certificate request waiting for instructor approval.</p>
      ) : certificate?.status === 'pending_admin' ? (
        <p>Instructor approved; waiting for final admin approval.</p>
      ) : eligible ? (
        <button className="button button-dark" type="button" onClick={requestCertificate} disabled={busy}>
          {busy ? 'Sending request…' : certificate?.status?.startsWith('declined') ? 'Request certificate again' : 'Request certificate'}
          <ArrowRight size={15} />
        </button>
      ) : (
        <>
          <button className="button button-dark" type="button" disabled>
            {certificate?.status?.startsWith('declined') ? 'Request certificate again' : 'Request certificate'}
          </button>
          <p>
            {`Complete all course lessons (${lessons.filter((lesson) => lesson.is_completed).length} of ${lessons.length} complete) to unlock your certificate request.`}
          </p>
        </>
      )}
      {certificate?.status?.startsWith('declined') && (
        <p>
          Previous request declined{(certificate.status === 'declined_instructor'
            ? certificate.instructor_note
            : certificate.admin_note)
            ? `: ${certificate.status === 'declined_instructor' ? certificate.instructor_note : certificate.admin_note}`
            : '.'}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function CourseCompletionScreen({ course, reloadCourse }) {
  return (
    <main className="course-completion-screen">
      <span className="completion-check"><Check size={30} /></span>
      <p className="section-kicker">COURSE COMPLETE</p>
      <h1>Wonderful work!</h1>
      <p>You completed every lesson and passed the required exercises and quizzes in <strong>{course.title}</strong>. Your progress is saved.</p>
      <CertificateAction course={course} reload={reloadCourse} />
      <Link className="course-completion-back" to="/student/dashboard">Back to My Learning</Link>
    </main>
  );
}

function LessonView({ lesson, quizzes, language, courseId, course, showQuizzes, reload }) {
  const editorSettings = getEditorSettings(language, lesson.code_example || '');
  const browserCode = editorSettings.mode !== 'edit';
  const [code, setCode] = useState(editorSettings.initialCode);
  const [previewCode, setPreviewCode] = useState(code);
  const [activeTab, setActiveTab] = useState(editorSettings.tabs[0]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [runOutput, setRunOutput] = useState('');
  const [runError, setRunError] = useState('');
  const [runningCode, setRunningCode] = useState(false);
  const runnerRef = useRef(null);
  const preview = previewDocument({ html: '', css: '', js: '', ...previewCode });
  const lessonQuizzes = quizzes.filter((quiz) => (
    quiz.lesson_id === lesson.id || (showQuizzes && quiz.lesson_id === null)
  ));

  useEffect(() => () => {
    if (runnerRef.current) {
      clearTimeout(runnerRef.current.timeoutId);
      runnerRef.current.worker.terminate();
    }
  }, []);

  function updateCode(value) {
    setCode((current) => ({ ...current, [activeTab]: value }));
  }

  function runCode() {
    setRunError('');
    setRunOutput('');
    if (editorSettings.mode === 'preview') {
      setPreviewCode(code);
      return;
    }

    setRunningCode(true);
    const worker = runnerRef.current?.worker ?? createCodeRunner(({ data }) => {
      const currentRunner = runnerRef.current;
      if (data.requestId !== currentRunner?.requestId) return;
      clearTimeout(currentRunner.timeoutId);
      if (data.error) setRunError(data.error);
      else setRunOutput(data.output || 'Code ran successfully. No output.');
      setRunningCode(false);
    }, (event) => {
      const currentRunner = runnerRef.current;
      if (!currentRunner) return;
      clearTimeout(currentRunner.timeoutId);
      currentRunner.worker.terminate();
      runnerRef.current = null;
      setRunError(event.message || 'The browser runtime failed to start.');
      setRunningCode(false);
    });
    const requestId = (runnerRef.current?.requestId ?? 0) + 1;
    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      runnerRef.current = null;
      setRunError('Execution took too long and was stopped. Check for an infinite loop and try again.');
      setRunningCode(false);
    }, 45000);
    runnerRef.current = { worker, requestId, timeoutId };
    worker.postMessage({ requestId, language: editorSettings.mode, code: code[activeTab] || '' });
  }

  async function completeLesson() {
    setBusy(true);
    setFeedback('');
    try {
      await apiRequest(`/student/lessons/${lesson.id}/complete`, { method: 'POST' });
      await reload();
      setFeedback('Lesson completed. Your progress has been saved.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="lesson-breadcrumb">{lesson.title.toUpperCase()}</div>
      <h1>{lesson.title}</h1>
      <LessonExplanation content={lesson.content} />
      <ReportContentForm courseId={courseId} targetType="lesson" lessonId={String(lesson.id)} contentTitle={lesson.title} />
      <h2>Code editor</h2>
      <p>{browserCode
        ? 'Try changing the code below and run it to see the result.'
        : `Try editing this ${language} example.`}</p>
      <div className="workspace-editor">
        <div className="editor-toolbar">
          <div className="editor-tabs" role="tablist" aria-label="Code files">
            {editorSettings.tabs.map((tab) => (
              <button role="tab" aria-selected={activeTab === tab} className={`editor-tab${activeTab === tab ? ' editor-tab-active' : ''}`} key={tab} onClick={() => setActiveTab(tab)}>
                <FileCode2 size={14} /> {tab.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="editor-toolbar-actions">
            <button onClick={() => { setCode(editorSettings.initialCode); setRunError(''); setRunOutput(''); }} className="editor-reset"><RotateCcw size={14} /> Reset</button>
            {browserCode && <button onClick={runCode} className="button button-run" disabled={runningCode}><Play size={13} fill="currentColor" /> {runningCode ? 'Running…' : 'Run code'}</button>}
          </div>
        </div>
        <label className="visually-hidden" htmlFor={`code-editor-${lesson.id}`}>{activeTab.toUpperCase()} code editor</label>
        <textarea id={`code-editor-${lesson.id}`} className="code-editor" spellCheck="false" value={code[activeTab]} onChange={(event) => updateCode(event.target.value)} />
        {editorSettings.mode === 'preview' && (
          <><div className="preview-heading"><span>{editorSettings.tabs.includes('html') ? 'LIVE PREVIEW' : 'JAVASCRIPT OUTPUT'}</span><span>Runs in an isolated browser preview</span></div><iframe title="Lesson code preview" className="code-preview-frame" sandbox="allow-scripts" srcDoc={preview} /></>
        )}
        {['python', 'php', 'mysql'].includes(editorSettings.mode) && (
          <>
            <div className="preview-heading"><span>RUN OUTPUT</span><span>{editorSettings.mode === 'mysql' ? 'Local MySQL-style SQL sandbox' : 'Runs locally in your browser'}</span></div>
            <pre className={`code-run-output${runError ? ' code-run-error' : ''}`} role="status">{runError || runOutput || (runningCode ? 'Starting the browser runtime…' : 'Run your code to see output.')}</pre>
            <p className="code-runtime-note">
              {editorSettings.mode === 'mysql'
                ? 'Supports common MySQL practice syntax in a local SQLite-based sandbox; advanced MySQL-specific syntax is not available.'
                : editorSettings.mode === 'php'
                  ? 'Runs locally; server requests and database connections are not available.'
                  : 'Python downloads its browser runtime on first use; your code stays in the browser.'}
            </p>
          </>
        )}
        {editorSettings.mode === 'edit' && <div className="preview-heading"><span>{language.toUpperCase()} EDITOR</span><span>Code execution is not available in this browser workspace</span></div>}
      </div>
      {!!lesson.materials.length && (
        <section className="course-lesson-extras">
          <h2><Download size={18} /> Learning materials</h2>
          {lesson.materials.map((material) => (
            <a key={material.id} href={`${apiOrigin}${material.url}`} target="_blank" rel="noreferrer">
              <Download size={15} /> {material.original_name}
            </a>
          ))}
        </section>
      )}
      {!!lesson.exercises.length && (
        <section className="course-lesson-extras">
          <h2><Code2 size={18} /> Practical exercises</h2>
          {lesson.exercises.map((exercise) => (
            <ExerciseForm key={`${exercise.id}-${exercise.submissions?.length || 0}`} exercise={exercise} reload={reload} language={language} lessonCode={lesson.code_example || ''} />
          ))}
        </section>
      )}
      {!!lessonQuizzes.length && (
        <section className="course-lesson-extras">
          <h2><CircleHelp size={18} /> Course quizzes</h2>
          {lessonQuizzes.map((quiz) => <QuizForm key={quiz.id} quiz={quiz} onSubmitted={reload} />)}
        </section>
      )}
      <CertificateAction course={course} reload={reload} />
      <div className="lesson-footer">
        <Link className="lesson-prev" to="/student/dashboard"><ArrowLeft size={15} /> My courses</Link>
        <button className="button button-dark lesson-next" type="button" onClick={completeLesson} disabled={busy || lesson.is_completed}>
          {lesson.is_completed ? 'Lesson completed' : busy ? 'Saving…' : 'Mark lesson complete'} <Check size={15} />
        </button>
      </div>
      {feedback && <p className="exercise-feedback feedback-success" role="status">{feedback}</p>}
      <Link to={`/courses/${courseId}`} className="course-overview-link">Course overview <ArrowRight size={15} /></Link>
    </>
  );
}

function LessonExplanation({ content }) {
  const sections = content.match(/^Brief explanation:\r?\n([\s\S]*?)\r?\n\r?\nDetailed explanation:\r?\n([\s\S]*)$/);
  if (!sections) {
    return <div className="course-lesson-explanation">{content.split(/\r?\n/).map((paragraph, index) => paragraph
      ? <p key={index}>{paragraph}</p> : null)}</div>;
  }
  return (
    <div className="course-lesson-explanation">
      <section><h2>Brief explanation</h2><p>{sections[1]}</p></section>
      <section><h2>Detailed explanation</h2>{sections[2].split(/\r?\n\r?\n/).map((paragraph, index) => paragraph
        ? <p key={index}>{paragraph}</p> : null)}</section>
    </div>
  );
}

function ExerciseForm({ exercise, reload, language, lessonCode }) {
  const previous = exercise.submissions?.[0];
  const [html, setHtml] = useState(previous?.submitted_html ?? exercise.starter_html ?? '');
  const [css, setCss] = useState(previous?.submitted_css ?? exercise.starter_css ?? '');
  const [javascript, setJavascript] = useState(previous?.submitted_javascript ?? exercise.starter_javascript ?? '');
  const [answerText, setAnswerText] = useState(previous?.answer_text ?? '');
  const [sourceCode, setSourceCode] = useState(previous?.answer_text ?? exercise.starter_javascript ?? lessonCode);
  const singleLanguageEditor = !['HTML & CSS', 'JavaScript', 'Data Structures'].includes(language);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const { message } = await apiRequest(`/student/exercises/${exercise.id}/submissions`, {
        method: 'POST',
        body: { html, css, javascript, answerText: singleLanguageEditor ? sourceCode : answerText },
      });
      setFeedback(message);
      await reload();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="course-exercise-form" onSubmit={submit}>
      <h3>{exercise.title}</h3>
      <p>{exercise.instructions}</p>
      {exercise.exercise_type === 'code' ? (
        singleLanguageEditor
          ? <label className="course-exercise-answer">{language} code<textarea required rows="8" spellCheck="false" value={sourceCode} onChange={(event) => setSourceCode(event.target.value)} /></label>
          : <div className="instructor-form-grid">
            <label>HTML<textarea rows="4" value={html} onChange={(event) => setHtml(event.target.value)} /></label>
            <label>CSS<textarea rows="4" value={css} onChange={(event) => setCss(event.target.value)} /></label>
            <label className="instructor-form-wide">JavaScript<textarea rows="4" value={javascript} onChange={(event) => setJavascript(event.target.value)} /></label>
          </div>
      ) : (
        <label className="course-exercise-answer">Your answer<textarea required rows="3" value={answerText} onChange={(event) => setAnswerText(event.target.value)} /></label>
      )}
      <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Send size={14} /> {busy ? 'Submitting…' : 'Submit exercise'}</button>
      {feedback && <p className="course-workspace-feedback" role="status">{feedback}</p>}
      {!!exercise.submissions?.length && <details className="submission-history"><summary>View {exercise.submissions.length} previous submission{exercise.submissions.length === 1 ? '' : 's'}</summary><ol>{exercise.submissions.map((submission, index) => <li key={`${submission.submitted_at}-${index}`}><strong>{submission.status === 'passed' ? 'Correct' : submission.status === 'needs_work' ? 'Needs work' : 'Awaiting review'}</strong> · {new Date(submission.submitted_at).toLocaleString()}{submission.score !== null && ` · ${submission.score}%`}{submission.feedback && <p>{submission.feedback}</p>}</li>)}</ol></details>}
    </form>
  );
}

function QuizForm({ quiz, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const result = await apiRequest(`/student/quizzes/${quiz.id}/attempts`, {
        method: 'POST',
        body: {
          answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
        },
      });
      setFeedback(`Your score: ${result.score}%. ${result.passed ? 'You passed!' : 'Review the lesson and try again.'}`);
      if (result.passed) await onSubmitted();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="course-quiz-form" onSubmit={submit}>
      <h3>{quiz.title}</h3>
      {quiz.description && <p>{quiz.description}</p>}
      {quiz.questions.map((question, index) => (
        <fieldset className="course-quiz-question" key={question.id}>
          <legend>{index + 1}. {question.prompt}</legend>
          {question.options.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`quiz-${quiz.id}-question-${question.id}`}
                value={option.id}
                checked={answers[question.id] === option.id}
                onChange={() => setAnswers({ ...answers, [question.id]: option.id })}
                required
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      ))}
      <button className="button button-dark instructor-submit" type="submit" disabled={busy}><Send size={14} /> {busy ? 'Submitting…' : 'Submit quiz'}</button>
      {feedback && <p className="course-workspace-feedback" role="status">{feedback}</p>}
    </form>
  );
}
