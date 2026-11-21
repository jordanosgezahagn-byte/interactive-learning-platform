import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.name.trim().split(/\s+/).length < 2) {
      setError('Enter your first and last name.');
      return;
    }
    if (!formData.email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Use a valid Gmail address ending in @gmail.com.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        },
      });
      navigate('/login', {
        replace: true,
        state: {
          registrationMessage: 'Check your Gmail inbox for a verification link. Verify your email before signing in.',
          email: formData.email.trim(),
        },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-compact">
        <div className="auth-heading">
          <div className="auth-heading-icon">
            <UserPlus size={22} />
          </div>
          <h2>Create Account</h2>
          <p>Join with your Gmail address</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="register-name">Full Name</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                id="register-name"
                type="text"
                name="name"
                autoComplete="name"
                maxLength={150}
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="First and last name"
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email Address</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                id="register-email"
                type="email"
                name="email"
                autoComplete="email"
                maxLength={254}
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="name@gmail.com"
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">Password</label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                id="register-password"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="auth-input auth-input-password"
              />
            </div>
          </div>

          <div className="auth-field auth-field-muted">
            <label>Role</label>
            <div className="auth-input-wrap">
              <ShieldCheck className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                type="text"
                value="Assigned by admin"
                readOnly
                className="auth-input auth-input-readonly"
                aria-label="Role assigned by administrator"
              />
            </div>
            <small className="auth-help-text">Role is managed by the database administrator in the roles table.</small>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}