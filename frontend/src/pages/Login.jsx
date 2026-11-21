import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { dashboardPathForRole } from '../lib/roles';

export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setVerificationRequired(false);
    setResendMessage('');
    setResendError('');
    setIsSubmitting(true);

    try {
      const { user } = await apiRequest('/api/auth/login', { method: 'POST', body: { email, password } });
      const dashboardPath = dashboardPathForRole(user.role);
      if (!dashboardPath) {
        setError('This account has an unsupported role. Contact an administrator.');
        return;
      }
      const returnPath = user.role === 'student' && location.state?.from;
      navigate(returnPath || dashboardPath, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setVerificationRequired(requestError.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResendMessage('');
    setResendError('');
    setIsResending(true);

    try {
      const { message } = await apiRequest('/api/auth/resend-verification', {
        method: 'POST',
        body: { email },
      });
      setResendMessage(message);
    } catch (requestError) {
      setResendError(requestError.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-heading">
          <div className="auth-heading-icon">
            <LogIn size={22} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to pick up where you left off.</p>
        </div>

        {location.state?.registrationMessage && (
          <p className="auth-success" role="status">{location.state.registrationMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="auth-input auth-input-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {verificationRequired && (
            <button
              type="button"
              className="auth-link-button"
              onClick={handleResendVerification}
              disabled={isResending || !email}
            >
              {isResending ? 'Sending link…' : 'Resend verification link'}
            </button>
          )}
          {resendMessage && <p className="auth-success" role="status">{resendMessage}</p>}
          {resendError && <p className="auth-error" role="alert">{resendError}</p>}
          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="auth-switch">
          New to CodeBloom?{' '}
          <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
