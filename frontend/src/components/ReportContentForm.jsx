import { useState } from 'react';
import { Flag } from 'lucide-react';
import { apiRequest } from '../lib/api';

const reasons = [
  ['inaccurate', 'Inaccurate information'],
  ['inappropriate', 'Inappropriate content'],
  ['broken', 'Broken example or link'],
  ['other', 'Other'],
];

export default function ReportContentForm({
  courseId, targetType, lessonId, contentTitle, onSignIn,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('inaccurate');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { message } = await apiRequest('/student/reports', {
        method: 'POST',
        body: {
          targetType,
          courseId,
          ...(targetType === 'lesson' ? { lessonId } : {}),
          reason,
          details,
        },
      });
      setNotice(message);
      setOpen(false);
      setDetails('');
    } catch (requestError) {
      if (requestError.status === 401 && onSignIn) onSignIn();
      else setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-report">
      {!notice && <button className="content-report-toggle" type="button" onClick={() => { setOpen((current) => !current); setError(''); }}>
        <Flag size={14} /> {open ? 'Cancel report' : `Report ${targetType === 'lesson' ? 'this lesson' : 'this course'}`}
      </button>}
      {open && (
        <form className="content-report-form" onSubmit={submit}>
          <strong>Report: {contentTitle}</strong>
          <label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}>
            {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Details <span>(optional)</span><textarea rows="3" maxLength={5000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell the administrators what should be reviewed." /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-dark button-small" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
        </form>
      )}
      {notice && <p className="auth-success" role="status">{notice}</p>}
    </div>
  );
}
