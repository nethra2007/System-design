import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import { Zap, ShoppingBag, ShieldCheck, Mail, Lock, ArrowRight, UserCheck } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center p-6 text-[#172033] font-sans">
      <div className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm space-y-8 text-center">
        {/* Brand Header */}
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#5B4BDB] text-white flex items-center justify-center mx-auto shadow-xs">
            <Zap size={28} className="fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">SALESTORM SENTINEL</h1>
          <p className="text-xs text-[#64748B] font-medium">Flash Sale Reliability & Control Platform</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#172033]">Choose your portal</h2>
          <p className="text-xs text-[#64748B]">Select how you want to experience the platform</p>
        </div>

        {/* Portal Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Customer Portal Card */}
          <div className="bg-[#F8FAFC] border border-[#E5E7EB] hover:border-[#5B4BDB]/40 rounded-xl p-6 text-left space-y-4 flex flex-col justify-between transition group">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-[#F3F0FF] text-[#5B4BDB] flex items-center justify-center">
                <ShoppingBag size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#172033]">CUSTOMER PORTAL</h3>
              <p className="text-xs text-[#64748B]">Shop the Flash Sale and purchase Product X</p>
            </div>
            <button
              onClick={() => navigate('/login?portal=customer')}
              className="w-full bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white py-2.5 rounded-lg font-semibold text-xs transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>Enter Customer Portal</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Control Tower Card */}
          <div className="bg-[#F8FAFC] border border-[#E5E7EB] hover:border-[#2563EB]/40 rounded-xl p-6 text-left space-y-4 flex flex-col justify-between transition group">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#172033]">CONTROL TOWER</h3>
              <p className="text-xs text-[#64748B]">Operate, stress-test, monitor, and prove system reliability</p>
            </div>
            <button
              onClick={() => navigate('/login?portal=admin')}
              className="w-full bg-[#172033] hover:bg-[#0F172A] text-white py-2.5 rounded-lg font-semibold text-xs transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>Enter Control Tower</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const initialRole: UserRole = queryParams.get('portal') === 'admin' ? 'ADMIN' : 'CUSTOMER';

  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState(role === 'ADMIN' ? 'admin@salestorm.com' : 'demo@salestorm.com');
  const [password, setPassword] = useState(role === 'ADMIN' ? 'admin123' : 'password123');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'ADMIN') {
      setEmail('admin@salestorm.com');
      setPassword('admin123');
    } else {
      setEmail('demo@salestorm.com');
      setPassword('password123');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      login(email, role);
      if (role === 'ADMIN') {
        navigate('/control-room');
      } else {
        navigate('/sale');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center p-6 text-[#172033] font-sans">
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#5B4BDB] text-white flex items-center justify-center mx-auto shadow-xs">
            <Zap size={24} className="fill-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SALESTORM SENTINEL</h1>
          <p className="text-xs text-[#64748B]">
            {role === 'ADMIN' ? 'Control Tower Operator Login' : 'Secure access to the flash sale'}
          </p>
        </div>

        {/* Portal Switcher Tabs */}
        <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-[#E5E7EB] text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleRoleChange('CUSTOMER')}
            className={`flex-1 py-1.5 rounded-md transition ${
              role === 'CUSTOMER' ? 'bg-white text-[#5B4BDB] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            Customer Login
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('ADMIN')}
            className={`flex-1 py-1.5 rounded-md transition ${
              role === 'ADMIN' ? 'bg-white text-[#172033] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            Control Tower Login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#172033]">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-[#94A3B8]" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#5B4BDB]"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#172033]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-[#94A3B8]" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#5B4BDB]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full text-white py-2.5 rounded-lg font-semibold text-xs transition shadow-xs flex items-center justify-center gap-1.5 ${
              role === 'ADMIN' ? 'bg-[#172033] hover:bg-[#0F172A]' : 'bg-[#5B4BDB] hover:bg-[#4C3CBD]'
            }`}
          >
            <span>{role === 'ADMIN' ? 'Enter Control Tower' : 'Sign In'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {role === 'CUSTOMER' && (
          <div className="text-center text-xs text-[#64748B]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#5B4BDB] font-semibold hover:underline">
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export const SignupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      login(email, 'CUSTOMER', name);
      navigate('/sale');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center p-6 text-[#172033] font-sans">
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#5B4BDB] text-white flex items-center justify-center mx-auto shadow-xs">
            <UserCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create Customer Account</h1>
          <p className="text-xs text-[#64748B]">Join the SALESTORM flash sale platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#172033]">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#5B4BDB]"
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#172033]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#5B4BDB]"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#172033]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#5B4BDB]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white py-2.5 rounded-lg font-semibold text-xs transition shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>Create Account</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div className="text-center text-xs text-[#64748B]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#5B4BDB] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
