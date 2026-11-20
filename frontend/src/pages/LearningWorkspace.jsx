import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight,
  CircleHelp, Code2, FileCode2, Lightbulb, Play, RotateCcw, Send,
} from 'lucide-react';

const initialCode = {
  html: '<main>\n  <h1>Hello, world!</h1>\n  <p>I am learning to build for the web.</p>\n</main>',
  css: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n  color: #234;\n}\n\nh1 {\n  color: #28735f;\n}',
  js: 'console.log("My first page is ready!");',
};

const lessons = [
  { name: 'Welcome to the web', done: true },
  { name: 'Your first HTML page', done: true },
  { name: 'Meet the elements', done: true },
  { name: 'Add a little structure', done: true },
  { name: 'Make it yours with CSS', active: true },
  { name: 'Colors, type & spacing' },
  { name: 'A page that responds' },
  { name: 'Mini project: your profile' },
];

function buildPreview(code) {
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${code.css}</style></head><body>${code.html}<script>${code.js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}

export default function LearningWorkspace() {
  const [code, setCode] = useState(initialCode);
  const [previewCode, setPreviewCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState('html');
  const [hasRun, setHasRun] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [completed, setCompleted] = useState(false);
  const preview = buildPreview(previewCode);

  function updateCode(value) {
    setCode((current) => ({ ...current, [activeTab]: value }));
    setHasRun(false);
  }

  function resetCode() {
    setCode(initialCode);
    setPreviewCode(initialCode);
    setFeedback('');
    setHasRun(false);
  }

  function checkExercise() {
    const documentFragment = new DOMParser().parseFromString(code.html, 'text/html');
    const heading = documentFragment.querySelector('h1');
    if (heading?.textContent?.trim() === 'Hello, world!') {
      setFeedback('That’s it! Your page has the heading it needs. Nice work.');
      setCompleted(true);
    } else {
      setFeedback('Not quite yet. Add an <h1>Hello, world!</h1> heading to your HTML and try again.');
    }
  }

  return (
    <div className="learning-shell">
      <header className="learning-topbar">
        <div className="learning-top-left"><Link to="/" className="workspace-brand"><span className="brand-mark"><Code2 size={18} strokeWidth={2.5} /></span><span>codebloom<span className="brand-period">.</span></span></Link><span className="top-divider" /><Link to="/student/dashboard" className="back-course"><ArrowLeft size={15} /> My learning</Link></div>
        <div className="learning-course-title"><span>HTML & CSS Foundations</span><ChevronRight size={14} /><strong>Make it yours with CSS</strong></div>
        <Link to="/student/dashboard" className="workspace-profile"><span className="profile-avatar">JD</span><ChevronDown size={14} /></Link>
      </header>
      <div className="workspace-layout">
        <aside className="lesson-sidebar">
          <Link to="/student/dashboard" className="sidebar-back"><ArrowLeft size={16} /> Course overview</Link>
          <div className="lesson-course-heading"><span className="lesson-course-icon">〈〉</span><div><strong>HTML & CSS</strong><small>Foundations</small></div></div>
          <div className="lesson-course-progress"><div className="lesson-progress-track"><span /></div><span>16 of 24 lessons</span></div>
          <div className="module-heading"><span>MODULE 3</span><ChevronDown size={15} /></div>
          <h2 className="module-title">Styling your page</h2>
          <nav className="lesson-list" aria-label="Course lessons">{lessons.map((lesson, index) => <a href={`#lesson-${index + 1}`} key={lesson.name} className={`lesson-item${lesson.active ? ' lesson-active' : ''}${lesson.done ? ' lesson-done' : ''}`}><span className="lesson-status">{lesson.done ? <Check size={13} /> : lesson.active ? <Play size={10} fill="currentColor" /> : <span>{index + 1}</span>}</span><span>{lesson.name}</span>{lesson.active && <span className="current-label">NOW</span>}</a>)}</nav>
          <div className="sidebar-help"><CircleHelp size={17} /><span>Need a hand?<small>We’re here to help you learn.</small></span><ChevronRight size={15} /></div>
        </aside>

        <main className="lesson-content">
          <div className="lesson-breadcrumb">MODULE 3 <ChevronRight size={13} /> STYLING YOUR PAGE</div>
          <h1>Make it yours with CSS</h1>
          <p className="lesson-intro">HTML gives your page its structure. CSS is where you get to bring it to life — with color, spacing, and a little bit of personality.</p>
          <div className="lesson-callout"><span><Lightbulb size={18} /></span><p><strong>Think of it like a house.</strong> HTML builds the rooms; CSS picks the paint, the furniture, and the cozy details.</p></div>
          <h2>Let’s try it together</h2>
          <p>Every web page can use a little style. The CSS below colors the heading and gives your page some breathing room. Try changing the color or adding a new style of your own.</p>
          <div className="workspace-editor">
            <div className="editor-toolbar"><div className="editor-tabs" role="tablist" aria-label="Code files">{['html', 'css', 'js'].map((tab) => <button role="tab" aria-selected={activeTab === tab} className={`editor-tab${activeTab === tab ? ' editor-tab-active' : ''}`} key={tab} onClick={() => setActiveTab(tab)}><FileCode2 size={14} /> {tab.toUpperCase()}</button>)}</div><div className="editor-toolbar-actions"><button onClick={resetCode} className="editor-reset"><RotateCcw size={14} /> Reset</button><button onClick={() => { setPreviewCode(code); setHasRun(true); }} className="button button-run"><Play size={13} fill="currentColor" /> Run code</button></div></div>
            <label className="visually-hidden" htmlFor="code-editor">{activeTab.toUpperCase()} code editor</label><textarea id="code-editor" className="code-editor" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={code[activeTab]} onChange={(event) => updateCode(event.target.value)} />
            <div className="preview-heading"><span><span className={`preview-live-dot${hasRun ? ' preview-live-on' : ''}`} /> LIVE PREVIEW</span><span>Runs safely in your browser</span></div>
            <iframe title="Live code preview" className="code-preview-frame" sandbox="allow-scripts" srcDoc={preview} />
          </div>
          <section className="exercise-card"><div className="exercise-heading"><span className="exercise-icon"><Code2 size={19} /></span><div><span className="section-kicker">QUICK PRACTICE</span><h2>Your turn</h2></div><span className="exercise-time">~ 2 min</span></div><p>Make sure your page has a main heading that says <code>Hello, world!</code>. You can edit the HTML above, then check your answer here.</p><button className="button button-dark submit-exercise" onClick={checkExercise}><Send size={14} /> Check my work</button>{feedback && <div className={`exercise-feedback${completed ? ' feedback-success' : ' feedback-retry'}`} role="status">{completed && <Check size={16} />}{feedback}</div>}</section>
          <div className="lesson-footer"><button className="lesson-prev"><ArrowLeft size={15} /> Previous lesson</button><button className="button button-dark lesson-next" onClick={() => setCompleted(true)}>Next lesson <ArrowRight size={15} /></button></div>
          {completed && <div className="completion-note" role="status"><Check size={15} /> Lesson progress saved for this session.</div>}
        </main>
      </div>
    </div>
  );
}
