import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, Check, ChevronDown, Code2, Flame, Menu,
  Play, Search, Sparkles, Terminal, X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

function Brand({ light = false }) {
  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="CodeBloom home">
      <span className="brand-mark"><Code2 size={19} strokeWidth={2.5} /></span>
      <span>codebloom<span className="brand-period">.</span></span>
    </Link>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`main-nav${menuOpen ? ' nav-open' : ''}`} aria-label="Main navigation">
          <a href="#courses" onClick={() => setMenuOpen(false)}>Explore</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <Link to="/student/dashboard" onClick={() => setMenuOpen(false)}>My learning</Link>
          <div className="nav-actions">
            <Link to="/login" className="nav-login">Log in</Link>
            <Link to="/register" className="button button-dark button-small">Get started <ArrowRight size={15} /></Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function CourseCard({ course }) {
  const firstCategory = course.category.split(',')[0].trim();
  const color = course.difficulty === 'advanced' ? 'blue'
    : course.difficulty === 'intermediate' ? 'yellow' : 'mint';
  return (
    <article className="course-card">
      <div className={`course-art art-${color}`}>
        <span className="course-art-icon">{firstCategory.slice(0, 2).toUpperCase()}</span>
        <span className="art-sparkle"><Sparkles size={16} /></span>
        <span className="art-code">{course.title}</span>
      </div>
      <div className="course-card-body">
        <div className="course-meta"><span>{firstCategory}</span><span className="meta-dot" />{course.difficulty}</div>
        <h3>{course.title}</h3>
        <div className="course-card-info"><span><BookOpen size={14} /> {course.lesson_count} lessons</span><span>{formatDuration(course.estimated_minutes)}</span></div>
        <Link to={`/courses/${course.id}`} className="course-card-link">Explore course <ArrowRight size={16} /></Link>
      </div>
    </article>
  );
}

function formatDuration(minutes) {
  if (!minutes) return 'Self paced';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All courses');
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [courseError, setCourseError] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/courses')
      .then(({ courses: publishedCourses }) => {
        if (active) setCourses(publishedCourses);
      })
      .catch((error) => {
        if (active) setCourseError(error.message);
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => ['All courses', ...new Set(courses.map((course) => course.category.split(',')[0].trim()))],
    [courses],
  );
  const filteredCourses = useMemo(() => courses.filter((course) => {
    const matchesCategory = activeCategory === 'All courses'
      || course.category.split(',').some((category) => category.trim() === activeCategory);
    const matchesSearch = `${course.title} ${course.category} ${course.difficulty} ${course.instructor_name}`.toLowerCase().includes(search.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  }), [activeCategory, courses, search]);

  return (
    <div className="public-page">
      <Header />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A little practice goes a long way</div>
            <h1>Grow your skills.<br /><span>Build what’s next.</span></h1>
            <p className="hero-description">A welcoming space to learn code by doing. Explore bite-sized lessons, try ideas in a real editor, and watch your confidence bloom.</p>
            <div className="hero-actions">
              <Link to="/register" className="button button-dark">Start learning free <ArrowRight size={17} /></Link>
              <Link to="/learn/html" className="button button-outline"><Play size={15} fill="currentColor" /> Try a lesson</Link>
            </div>
            <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><p><strong>A good place to begin.</strong><br />Made for curious minds at every level.</p></div>
          </div>
          <div className="hero-visual" aria-label="Illustration of an interactive coding lesson">
            <div className="hero-sun" />
            <div className="hero-sticker sticker-top"><Sparkles size={15} /> learn by doing</div>
            <div className="editor-card">
              <div className="editor-card-top"><div className="window-dots"><i /><i /><i /></div><span>your-first-page.html</span><span className="live-tag"><span /> LIVE</span></div>
              <div className="editor-card-code">
                <div><b>1</b><span className="code-purple">&lt;main&gt;</span></div>
                <div><b>2</b><span className="code-pink">&nbsp;&nbsp;&lt;h1&gt;</span><span className="code-green">Hello, world!</span><span className="code-pink">&lt;/h1&gt;</span></div>
                <div><b>3</b><span className="code-purple">&lt;/main&gt;</span></div>
                <div className="code-spacer" />
                <div className="code-preview"><span className="preview-label">YOUR PREVIEW</span><strong>Hello, world!</strong><span>Your first page is looking good.</span><span className="preview-button">Nice work <Check size={12} /></span></div>
              </div>
            </div>
            <div className="hero-float-card"><span className="float-icon"><Check size={17} /></span><span><strong>Lesson complete!</strong><small>One step at a time</small></span><span className="float-confetti">✳</span></div>
            <span className="hero-doodle doodle-one">✳</span><span className="hero-doodle doodle-two">✦</span>
          </div>
        </section>

        <section className="trust-strip" aria-label="Learning highlights">
          <div><span className="trust-icon trust-green"><Terminal size={18} /></span><span><strong>Learn by building</strong><small>Real practice, right in your browser</small></span></div>
          <div><span className="trust-icon trust-yellow"><Flame size={18} /></span><span><strong>Your pace, your path</strong><small>Short lessons that fit your day</small></span></div>
          <div><span className="trust-icon trust-purple"><Award size={18} /></span><span><strong>Celebrate your progress</strong><small>See how far you’ve come</small></span></div>
        </section>

        <section className="courses-section" id="courses">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR NEXT CHAPTER</span><h2>Find your starting point<span className="brand-period">.</span></h2><p>Pick a topic that sparks your curiosity. You can always explore more later.</p></div>
            <Link to="/student/dashboard" className="text-link">View your learning <ArrowRight size={16} /></Link>
          </div>
          <div className="course-tools">
            <div className="category-list" role="group" aria-label="Filter courses by category">
              {categories.map((category) => <button key={category} className={`category-chip${activeCategory === category ? ' chip-active' : ''}`} onClick={() => setActiveCategory(category)}>{category}</button>)}
              <button className="category-more" onClick={() => setActiveCategory('All courses')}>More <ChevronDown size={14} /></button>
            </div>
            <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a course" aria-label="Search courses" /></label>
          </div>
          {loadingCourses ? <div className="empty-courses" role="status">Loading published courses…</div>
            : courseError ? <div className="empty-courses" role="alert">{courseError}</div>
              : filteredCourses.length ? <div className="course-grid">{filteredCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div>
                : <div className="empty-courses">{courses.length ? 'No courses match that search yet. Try another topic.' : 'No courses have been published yet. Check back soon.'}</div>}
          <div className="browse-row"><span>Want to try the coding editor before enrolling?</span><Link to="/learn/html" className="text-link">Try the sample lesson <ArrowRight size={16} /></Link></div>
        </section>

        <section className="how-section" id="how-it-works"><span className="section-kicker">SIMPLE BY DESIGN</span><h2>Small steps. Real progress.</h2><div className="how-grid"><article><span className="how-number">01</span><h3>Choose a learning path</h3><p>Follow a clear course, or dip into a topic that catches your eye.</p></article><article><span className="how-number">02</span><h3>Try it for yourself</h3><p>Write code, run it safely in your browser, and see what happens.</p></article><article><span className="how-number">03</span><h3>Keep your momentum</h3><p>Track completed lessons and come back right where you left off.</p></article></div></section>
      </main>
      <footer className="site-footer"><Brand /><span>Made for the joy of figuring things out.</span><span>© 2025 CodeBloom</span></footer>
    </div>
  );
}
