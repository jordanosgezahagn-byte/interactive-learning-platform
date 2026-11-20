import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Award, BookOpen, Code2, FileText, GraduationCap,
  LayoutDashboard, LogOut, Plus, Shield, Trash2, Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

const emptyData = {
  statistics: {},
  users: [],
  courses: [],
  instructors: [],
  categories: [],
  certificates: [],
  reports: [],
};

const reportReasons = {
  inaccurate: 'Inaccurate information',
  inappropriate: 'Inappropriate content',
  broken: 'Broken example or link',
  other: 'Other',
};

export default function AdminDashboard({
  user, today, initials, onLogout, isLoggingOut, logoutError,
}) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  async function loadDashboard(isActive = () => true) {
    const results = await Promise.allSettled([
      apiRequest('/admin/overview'),
      apiRequest('/admin/users'),
      apiRequest('/admin/courses'),
      apiRequest('/admin/certificates'),
      apiRequest('/admin/reports'),
    ]);
    const next = { ...emptyData };
    const errors = [];
    const [overview, users, courses, certificates, reports] = results;
    if (!isActive()) return;
    if (overview.status === 'fulfilled') next.statistics = overview.value.statistics;
    else errors.push(overview.reason.message);
    if (users.status === 'fulfilled') next.users = users.value.users;
    else errors.push(users.reason.message);
    if (courses.status === 'fulfilled') Object.assign(next, courses.value);
    else errors.push(courses.reason.message);
    if (certificates.status === 'fulfilled') next.certificates = certificates.value.certificates;
    else errors.push(certificates.reason.message);
    if (reports.status === 'fulfilled') next.reports = reports.value.reports;
    else errors.push(reports.reason.message);
    setData(next);
    setError(errors.length ? `Some administrator data could not be loaded: ${errors.join(' ')}` : '');
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => loadDashboard(() => active));
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.users.filter((item) => !query
      || `${item.full_name} ${item.email} ${item.role}`.toLowerCase().includes(query));
  }, [data.users, search]);
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.courses.filter((item) => !query
      || `${item.title} ${item.instructor_name} ${item.category_names || ''}`.toLowerCase().includes(query));
  }, [data.courses, search]);

  async function perform(key, action, successMessage) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      await loadDashboard();
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  function updateUserDraft(userId, key, value) {
    setData((current) => ({
      ...current,
      users: current.users.map((item) => item.id === userId ? { ...item, [key]: value } : item),
    }));
  }

  function updateCourseDraft(courseId, key, value) {
    setData((current) => ({
      ...current,
      courses: current.courses.map((item) => item.id === courseId ? { ...item, [key]: value } : item),
    }));
  }

  function updateReportDraft(reportId, key, value) {
    setData((current) => ({
      ...current,
      reports: current.reports.map((item) => item.id === reportId ? { ...item, [key]: value } : item),
    }));
  }

  async function submitCategory(event) {
    event.preventDefault();
    await perform('category-create', async () => {
      await apiRequest('/admin/categories', { method: 'POST', body: categoryForm });
      setCategoryForm({ name: '', description: '' });
    }, 'Category created.');
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/">
          <span className="brand-mark"><Code2 size={19} strokeWidth={2.5} /></span>
          <span>codebloom<span className="brand-period">.</span></span>
        </Link>
        <div className="sidebar-label">PLATFORM ADMIN</div>
        <nav className="dashboard-nav" aria-label="Administrator navigation">
          <a className="dashboard-nav-item selected" href="#admin-overview"><LayoutDashboard size={18} /> Overview</a>
          <a className="dashboard-nav-item" href="#admin-users"><Users size={18} /> Users and roles</a>
          <a className="dashboard-nav-item" href="#admin-courses"><BookOpen size={18} /> Courses</a>
          <a className="dashboard-nav-item" href="#admin-categories"><FileText size={18} /> Categories</a>
          <a className="dashboard-nav-item" href="#admin-reports"><Activity size={18} /> Content reports</a>
          <a className="dashboard-nav-item" href="#admin-certificates"><Award size={18} /> Certificates</a>
        </nav>
        <div className="sidebar-promo">
          <div className="promo-icon"><Shield size={19} /></div>
          <strong>Platform administration</strong>
          <p>Manage accounts and learning content from one workspace.</p>
        </div>
        <div className="sidebar-bottom">
          <button className="dashboard-nav-item dashboard-nav-button" type="button" onClick={onLogout} disabled={isLoggingOut}>
            <LogOut size={18} /> {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
          <div className="profile-mini">
            <span className="profile-avatar">{initials}</span>
            <span><strong>{user.fullName}</strong><small>Administrator</small></span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb">CodeBloom <span aria-hidden="true">/</span> <strong>Administrator dashboard</strong></div>
          <div className="topbar-actions"><span className="profile-avatar top-avatar">{initials}</span></div>
        </header>
        <main className="dashboard-content admin-dashboard-content" id="admin-overview">
          <section className="welcome-row">
            <div>
              <div className="welcome-date">{today}</div>
              <h1>Administrator dashboard</h1>
              <p>Manage platform accounts, courses, and learning activity.</p>
            </div>
            <label className="dashboard-search admin-search">
              <Users size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users and courses" aria-label="Search users and courses" />
            </label>
          </section>
          {error && <p className="auth-error admin-feedback" role="alert">{error}</p>}
          {notice && <p className="auth-success admin-feedback" role="status">{notice}</p>}
          {loading && <p className="instructor-muted" role="status">Loading platform data…</p>}

          <section className="stats-grid admin-stats-grid" aria-label="Platform statistics">
            <StatCard icon={Users} label="STUDENTS" value={data.statistics.students} note="Registered student accounts" />
            <StatCard icon={GraduationCap} label="INSTRUCTORS" value={data.statistics.instructors} note="Instructor accounts" />
            <StatCard icon={BookOpen} label="COURSES" value={data.statistics.courses} note="All course statuses" />
            <StatCard icon={Code2} label="LESSONS" value={data.statistics.lessons} note="Across all courses" />
            <StatCard icon={Activity} label="ENROLLMENTS" value={data.statistics.enrollments} note="Course enrollments" />
            <StatCard icon={Award} label="CERTIFICATES" value={data.statistics.certificates} note="Issued records" />
            <StatCard icon={FileText} label="OPEN REPORTS" value={data.statistics.open_reports} note="Awaiting moderation" />
          </section>

          <section className="instructor-panel admin-panel" id="admin-users">
            <PanelHeading title="Users and roles" description="Change account roles and enable or disable platform access." />
            <div className="admin-table-wrap">
              <table className="instructor-table admin-table">
                <thead><tr><th>User</th><th>Role</th><th>Account</th><th>Courses</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.full_name}</strong><small>{item.email}{item.email_verified_at ? ' · verified' : ' · unverified'}</small></td>
                      <td><select aria-label={`Role for ${item.full_name}`} value={item.role} disabled={item.id === user.id} onChange={(event) => updateUserDraft(item.id, 'role', event.target.value)}>
                        <option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option>
                      </select></td>
                      <td><select aria-label={`Status for ${item.full_name}`} value={item.status} disabled={item.id === user.id} onChange={(event) => updateUserDraft(item.id, 'status', event.target.value)}>
                        <option value="active">Active</option><option value="disabled">Disabled</option>
                      </select></td>
                      <td>{item.course_count}</td>
                      <td><button className="button button-small admin-action" type="button" disabled={busy === `user-${item.id}` || item.id === user.id} onClick={() => perform(`user-${item.id}`, () => apiRequest(`/admin/users/${item.id}`, { method: 'PATCH', body: { role: item.role, status: item.status } }), 'User account updated.')}>{busy === `user-${item.id}` ? 'Saving…' : 'Save'}</button></td>
                    </tr>
                  ))}
                  {!loading && !filteredUsers.length && <EmptyRow columns={5} text="No matching users." />}
                </tbody>
              </table>
            </div>
            <p className="instructor-muted admin-footnote">For safety, you cannot change your own account. The last active administrator cannot be disabled or demoted.</p>
          </section>

          <section className="instructor-panel admin-panel" id="admin-courses">
            <PanelHeading title="Courses and instructors" description="Assign an active instructor, update course availability, and organize course categories." />
            <div className="admin-table-wrap">
              <table className="instructor-table admin-table admin-course-table">
                <thead><tr><th>Course</th><th>Instructor</th><th>Status</th><th>Categories</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredCourses.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong><small>{item.enrollment_count} enrollments · {item.difficulty}</small></td>
                      <td><select aria-label={`Instructor for ${item.title}`} value={item.instructor_id} onChange={(event) => updateCourseDraft(item.id, 'instructor_id', event.target.value)}>
                        {data.instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name}</option>)}
                      </select></td>
                      <td><select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => updateCourseDraft(item.id, 'status', event.target.value)}>
                        <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
                      </select></td>
                      <td><select multiple aria-label={`Categories for ${item.title}`} value={item.category_ids} onChange={(event) => updateCourseDraft(item.id, 'category_ids', [...event.target.selectedOptions].map((option) => option.value))}>
                        {data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select></td>
                      <td><button className="button button-small admin-action" type="button" disabled={busy === `course-${item.id}`} onClick={() => perform(`course-${item.id}`, () => apiRequest(`/admin/courses/${item.id}`, { method: 'PATCH', body: { status: item.status, instructorId: item.instructor_id, categoryIds: item.category_ids } }), 'Course settings updated.')}>{busy === `course-${item.id}` ? 'Saving…' : 'Save'}</button></td>
                    </tr>
                  ))}
                  {!loading && !filteredCourses.length && <EmptyRow columns={5} text="No matching courses." />}
                </tbody>
              </table>
            </div>
          </section>

          <section className="instructor-panel admin-panel" id="admin-categories">
            <PanelHeading title="Categories" description="Create, rename, and remove course categories." />
            <form className="instructor-form admin-category-form" onSubmit={submitCategory}>
              <label>Category name<input required maxLength={100} value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Description<input maxLength={5000} value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <button className="button button-dark button-small" type="submit" disabled={busy === 'category-create'}><Plus size={14} /> Add category</button>
            </form>
            <div className="admin-category-list">
              {data.categories.map((category) => <CategoryRow key={category.id} category={category} busy={busy} perform={perform} />)}
              {!loading && !data.categories.length && <p className="instructor-muted">No categories yet.</p>}
            </div>
          </section>

          <section className="instructor-panel admin-panel" id="admin-reports">
            <PanelHeading title="Reported learning content" description="Review reports submitted by students and record moderation decisions." />
            <div className="admin-table-wrap">
              <table className="instructor-table admin-table">
                <thead><tr><th>Content</th><th>Report</th><th>Reporter</th><th>Status and notes</th><th>Action</th></tr></thead>
                <tbody>
                  {data.reports.map((item) => <ReportRow key={item.id} report={item} busy={busy} updateDraft={updateReportDraft} perform={perform} />)}
                  {!loading && !data.reports.length && <EmptyRow columns={5} text="No content reports have been submitted." />}
                </tbody>
              </table>
            </div>
          </section>

          <section className="instructor-panel admin-panel" id="admin-certificates">
            <PanelHeading title="Certificate approvals" description="Review instructor-approved requests, inspect learning progress, and issue or decline certificates." />
            <div className="admin-table-wrap">
              <table className="instructor-table admin-table">
                <thead><tr><th>Certificate</th><th>Student</th><th>Course and progress</th><th>Requested / issued</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {data.certificates.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.certificate_code}</strong></td>
                      <td><strong>{item.student_name}</strong><small>{item.email}</small></td>
                      <td>
                        <strong>{item.course_title}</strong>
                        <small>Lessons {item.completed_lessons}/{item.total_lessons}; exercises {item.passed_exercises}/{item.total_exercises}; quizzes {item.passed_quizzes}/{item.total_quizzes}</small>
                      </td>
                      <td>{item.issued_at ? new Date(item.issued_at).toLocaleDateString() : new Date(item.requested_at).toLocaleDateString()}</td>
                      <td>{item.revoked_at ? 'Revoked'
                        : item.status === 'pending_instructor' ? 'Waiting for instructor'
                          : item.status === 'pending_admin' ? 'Awaiting final review'
                            : item.status === 'declined_instructor' ? 'Declined by instructor'
                              : item.status === 'declined_admin' ? 'Declined by admin'
                                : 'Issued'}</td>
                      <td>
                        {item.status === 'pending_admin' ? (
                          <div className="certificate-review-actions">
                            <button className="button button-small admin-action" type="button" disabled={busy === `certificate-${item.id}`} onClick={() => perform(`certificate-${item.id}`, () => apiRequest(`/admin/certificates/${item.id}`, { method: 'PATCH', body: { decision: 'approve' } }), 'Certificate approved and issued.')}>Approve</button>
                            <button className="instructor-archive-button" type="button" disabled={busy === `certificate-${item.id}`} onClick={() => perform(`certificate-${item.id}`, () => apiRequest(`/admin/certificates/${item.id}`, { method: 'PATCH', body: { decision: 'decline' } }), 'Certificate request declined.')}>Decline</button>
                          </div>
                        ) : item.status === 'issued' ? (
                          <button className="button button-small admin-action" type="button" disabled={busy === `certificate-${item.id}`} onClick={() => perform(`certificate-${item.id}`, () => apiRequest(`/admin/certificates/${item.id}`, { method: 'PATCH', body: { revoked: !item.revoked_at } }), item.revoked_at ? 'Certificate restored.' : 'Certificate revoked.')}>{item.revoked_at ? 'Restore' : 'Revoke'}</button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!loading && !data.certificates.length && <EmptyRow columns={6} text="No certificate requests have been submitted." />}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value = 0, note }) {
  return <article className="stat-card"><span className="stat-icon stat-mint"><Icon size={18} /></span><span className="stat-label">{label}</span><strong>{value ?? 0}</strong><small>{note}</small></article>;
}

function PanelHeading({ title, description }) {
  return <div className="instructor-panel-heading"><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function EmptyRow({ columns, text }) {
  return <tr><td colSpan={columns} className="admin-empty-row">{text}</td></tr>;
}

function CategoryRow({ category, busy, perform }) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || '');
  return (
    <form className="admin-category-row" onSubmit={(event) => {
      event.preventDefault();
      perform(`category-${category.id}`, () => apiRequest(`/admin/categories/${category.id}`, { method: 'PATCH', body: { name, description } }), 'Category updated.');
    }}>
      <label>Category<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Description<input maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <button className="button button-small admin-action" type="submit" disabled={busy === `category-${category.id}`}>Save</button>
      <button className="admin-delete-button" type="button" aria-label={`Delete ${category.name}`} disabled={busy === `category-delete-${category.id}`} onClick={() => {
        if (window.confirm(`Delete the ${category.name} category?`)) {
          perform(`category-delete-${category.id}`, () => apiRequest(`/admin/categories/${category.id}`, { method: 'DELETE' }), 'Category deleted.');
        }
      }}><Trash2 size={15} /></button>
    </form>
  );
}

function ReportRow({ report, busy, updateDraft, perform }) {
  return (
    <tr>
      <td><strong>{report.target_title}</strong><small>{report.target_type}{report.course_status ? ` · course ${report.course_status}` : ''}</small></td>
      <td><strong>{reportReasons[report.reason]}</strong><small>{report.details || 'No additional details'}</small></td>
      <td><strong>{report.reporter_name}</strong><small>{report.reporter_email}</small></td>
      <td><div className="admin-report-fields">
        <select aria-label={`Status for report ${report.id}`} value={report.status} onChange={(event) => updateDraft(report.id, 'status', event.target.value)}>
          <option value="open">Open</option><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
        </select>
        <textarea aria-label={`Admin note for report ${report.id}`} maxLength={5000} value={report.admin_note || ''} placeholder="Moderation note" onChange={(event) => updateDraft(report.id, 'admin_note', event.target.value)} />
      </div></td>
      <td><button className="button button-small admin-action" type="button" disabled={busy === `report-${report.id}`} onClick={() => perform(`report-${report.id}`, () => apiRequest(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status: report.status, adminNote: report.admin_note || '' } }), 'Report decision saved.')}>{busy === `report-${report.id}` ? 'Saving…' : 'Save'}</button></td>
    </tr>
  );
}
