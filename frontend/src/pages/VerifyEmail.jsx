import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState(() => (
    token
      ? { status: 'loading', message: '' }
      : { status: 'error', message: 'This verification link is missing its token.' }
  ));

  useEffect(() => {
    let active = true;

    if (!token) {
      return undefined;
    }

    apiRequest('/auth/verify-email', { method: 'POST', body: { token } })
      .then(({ message }) => {
        if (active) setState({ status: 'success', message });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', message: error.message });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-heading">
          <h2>{state.status === 'loading' ? 'Verifying your email…' : 'Email verification'}</h2>
        </div>
        {state.status === 'loading' && <p role="status">Please wait while we verify your Gmail address.</p>}
        {state.status === 'success' && <p className="auth-success" role="status">{state.message}</p>}
        {state.status === 'error' && <p className="auth-error" role="alert">{state.message}</p>}
        {state.status !== 'loading' && (
          <p className="auth-switch">
            <Link to="/login">Go to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
