import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function CertificatePage() {
  const { certificateCode } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest(`/certificates/${encodeURIComponent(certificateCode)}`)
      .then(({ certificate: result }) => {
        if (active) setCertificate(result);
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
  }, [certificateCode]);

  if (loading) {
    return <main className="certificate-page"><p role="status">Verifying certificate…</p></main>;
  }
  if (error || !certificate) {
    return (
      <main className="certificate-page">
        <p className="auth-error" role="alert">{error || 'Certificate not found.'}</p>
        <Link className="course-details-back" to="/"><ArrowLeft size={15} /> Return to CodeBloom</Link>
      </main>
    );
  }

  const verificationUrl = `${window.location.origin}/verify/${certificate.certificate_code}`;
  const completionDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${certificate.completion_date}T00:00:00Z`));

  return (
    <main className="certificate-page">
      <div className="certificate-toolbar">
        <Link className="course-details-back" to="/student/dashboard"><ArrowLeft size={15} /> Back to dashboard</Link>
        <button className="button button-dark" type="button" onClick={() => window.print()}>
          <Download size={15} /> Download / print certificate
        </button>
      </div>
      {!certificate.is_valid && <p className="certificate-revoked" role="alert">This certificate has been revoked and is no longer valid.</p>}
      <article className="certificate-paper">
        <div className="certificate-frame">
          <div className="certificate-brand"><span className="brand-mark"><Award size={19} /></span> codebloom<span className="brand-period">.</span></div>
          <p className="certificate-kicker">CERTIFICATE OF COMPLETION</p>
          <h1>Certificate</h1>
          <p className="certificate-copy">This certificate is proudly presented to</p>
          <p className="certificate-learner">{certificate.learner_name}</p>
          <p className="certificate-copy">for successfully completing the course</p>
          <h2>{certificate.course_title}</h2>
          <div className="certificate-seal"><Award size={30} /></div>
          <p className="certificate-date">Completed on {completionDate}</p>
          <div className="certificate-identifiers">
            <span>Certificate ID<strong>{certificate.certificate_code}</strong></span>
            <span>Verify this certificate<strong>{verificationUrl}</strong></span>
          </div>
          <p className="certificate-validity"><ShieldCheck size={14} /> {certificate.is_valid ? 'Verified by CodeBloom' : 'Revoked — not valid'}</p>
        </div>
      </article>
      <p className="certificate-print-hint">Use your browser’s print dialog and choose “Save as PDF” to download a copy.</p>
    </main>
  );
}
