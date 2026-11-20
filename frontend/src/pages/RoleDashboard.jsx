import { Link } from 'react-router-dom';
import {
  Award, BookOpen, ChartNoAxesCombined, Code2, FileText, GraduationCap,
  LayoutDashboard, LogOut, MessageSquareWarning, Settings, Shield, Users,
} from 'lucide-react';

const roleContent = {
  instructor: {
    title: 'Instructor workspace',
    description: 'Create learning experiences and follow your students’ progress.',
    navigationLabel: 'TEACHING SPACE',
    sections: [
      { icon: BookOpen, title: 'Courses', description: 'Create, edit, publish, and organize your courses.' },
      { icon: FileText, title: 'Lessons and materials', description: 'Build modules and lessons with explanations, code examples, and learning materials.' },
      { icon: Code2, title: 'Exercises and quizzes', description: 'Prepare practical exercises and quizzes for your learners.' },
      { icon: Users, title: 'Students and performance', description: 'Review course enrollment and track student performance.' },
    ],
  },
  admin: {
    title: 'Administrator dashboard',
    description: 'Oversee platform accounts, learning content, and activity.',
    navigationLabel: 'PLATFORM ADMIN',
    sections: [
      { icon: Users, title: 'Users and roles', description: 'Manage students, instructors, and account roles.' },
      { icon: BookOpen, title: 'Courses and categories', description: 'Manage courses, categories, and instructor assignments.' },
      { icon: ChartNoAxesCombined, title: 'Platform statistics', description: 'Review student, instructor, course, and lesson totals.' },
      { icon: Award, title: 'Certificates and reports', description: 'Review certificate records and reported learning content.' },
    ],
  },
};

export default function RoleDashboard({ user, today, initials, onLogout, isLoggingOut, logoutError }) {
  const content = roleContent[user.role];
  const dashboardPath = `/${user.role}/dashboard`;

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/">
          <span className="brand-mark"><Code2 size={19} strokeWidth={2.5} /></span>
          <span>codebloom<span className="brand-period">.</span></span>
        </Link>
        <div className="sidebar-label">{content.navigationLabel}</div>
        <nav className="dashboard-nav" aria-label={`${content.title} navigation`}>
          <Link className="dashboard-nav-item selected" to={dashboardPath}>
            <LayoutDashboard size={18} /> Overview
          </Link>
          {content.sections.map(({ icon: Icon, title }) => (
            <a className="dashboard-nav-item" href={`#${sectionId(title)}`} key={title}>
              <Icon size={18} /> {title}
            </a>
          ))}
        </nav>
        {user.role === 'admin' && (
          <div className="sidebar-promo">
            <div className="promo-icon"><Shield size={19} /></div>
            <strong>Platform administration</strong>
            <p>Manage learning resources and keep the platform running smoothly.</p>
          </div>
        )}
        {user.role === 'instructor' && (
          <div className="sidebar-promo">
            <div className="promo-icon"><GraduationCap size={19} /></div>
            <strong>Your teaching space</strong>
            <p>Build courses, share practice, and support learner growth.</p>
          </div>
        )}
        <div className="sidebar-bottom">
          <a className="dashboard-nav-item" href="#workspace-settings"><Settings size={18} /> Settings</a>
          <button className="dashboard-nav-item dashboard-nav-button" type="button" onClick={onLogout} disabled={isLoggingOut}>
            <LogOut size={18} /> {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
          <div className="profile-mini">
            <span className="profile-avatar">{initials}</span>
            <span><strong>{user.fullName}</strong><small>{user.role}</small></span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb">CodeBloom <span aria-hidden="true">/</span> <strong>{content.title}</strong></div>
          <div className="topbar-actions"><span className="profile-avatar top-avatar">{initials}</span></div>
        </header>
        <main className="dashboard-content role-dashboard-content">
          <section className="welcome-row">
            <div>
              <div className="welcome-date">{today}</div>
              <h1>Welcome, {user.fullName.split(/\s+/)[0]}</h1>
              <p>{content.description}</p>
            </div>
          </section>

          <section className="role-dashboard-notice" role="note">
            <MessageSquareWarning size={18} />
            <p>
              These sections identify the tools for your role. Course, user, reporting, and statistics
              management still need their data and actions connected to the platform.
            </p>
          </section>

          <section className="role-dashboard-grid" aria-label={content.title}>
            {content.sections.map(({ icon: Icon, title, description }) => (
              <article className="role-dashboard-card" id={sectionId(title)} key={title}>
                <span className="role-dashboard-icon"><Icon size={20} /></span>
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </section>
          <span id="workspace-settings" />
        </main>
      </div>
    </div>
  );
}

function sectionId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
