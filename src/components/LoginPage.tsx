import React, { useState } from 'react';
import { Moon, Sun, Eye, EyeOff, Activity, AlertCircle, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export interface LoginPageProps {
  onLoginSubmit: (email: string, password: string) => void;
  onNavigateToSignUp: () => void;
  isLoading: boolean;
  errorState: null | 'invalid' | 'locked' | 'network';
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function LoginPage({
  onLoginSubmit,
  onNavigateToSignUp,
  isLoading,
  errorState,
  theme,
  toggleTheme
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errorState === 'locked' || isLoading) return;
    onLoginSubmit(email, password);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-300">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <button 
          onClick={toggleTheme} 
          aria-label="Toggle dark mode"
          className="flex items-center space-x-3 bg-light-card dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-md px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-bg text-light-text-secondary dark:text-dark-text-secondary"
        >
          <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline-block">
            {theme === 'light' ? 'DARK MODE' : 'LIGHT MODE'}
          </span>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      {/* Card */}
      <div className="w-full max-w-[420px] relative bg-light-card dark:bg-dark-card rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-none border border-gray-300 dark:border-dark-border overflow-hidden flex flex-col">
        
        {/* Banners (Edge-to-edge at top) */}
        {errorState === 'locked' && (
          <div className="bg-brand-error text-white py-2.5 px-4 text-xs font-bold flex items-center justify-center uppercase tracking-widest text-center">
              <Lock className="mr-2 shrink-0" size={14} />
              Account Locked — Too Many Failed Attempts
          </div>
        )}
        {errorState === 'network' && (
          <div className="bg-brand-error text-white py-2.5 px-4 text-xs font-bold flex items-center justify-center uppercase tracking-widest text-center">
              <AlertCircle className="mr-2 shrink-0" size={14} />
              Network Error — Check Connection
          </div>
        )}

        <div className="p-10 pb-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-2">
                <Activity className="text-brand-primary mr-2" size={24} />
                <h1 className="text-xl font-bold text-light-text dark:text-dark-text uppercase tracking-tight">Pulse Monitoring</h1>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Enter your credentials to manage the device fleet.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider" htmlFor="email">
                  Email or Username
                </label>
                <input 
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={errorState === 'locked' || isLoading}
                  className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-sm text-sm text-light-text dark:text-dark-text placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-shadow disabled:opacity-50`}
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={errorState === 'locked' || isLoading}
                    className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${errorState === 'invalid' ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:border-transparent transition-shadow disabled:opacity-50 pr-10`}
                    placeholder="Enter your password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={errorState === 'locked' || isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded disabled:opacity-50 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errorState === 'invalid' && (
                  <span className="text-brand-error text-[11px] block mt-1 font-medium">
                    Invalid email or password combination
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center text-xs text-light-text-secondary dark:text-dark-text-secondary cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={errorState === 'locked' || isLoading}
                    className="mr-2 w-4 h-4 rounded-sm border-gray-300 dark:border-dark-border text-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-card dark:bg-dark-bg cursor-pointer disabled:opacity-50"
                  />
                  Remember me
                </label>
                <a href="#" className="text-xs text-brand-primary hover:underline font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded">
                  Forgot password?
                </a>
              </div>

              <button 
                type="submit"
                disabled={errorState === 'locked' || isLoading || !email || !password}
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 rounded-sm uppercase tracking-widest text-xs mt-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {isLoading ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : 'Log in'}
              </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              New here? <button onClick={onNavigateToSignUp} className="text-brand-primary hover:underline font-semibold outline-none focus-visible:underline cursor-pointer">Sign up</button>
            </p>
          </div>
        </div>

        {/* Signature Waveform */}
        <div className="absolute bottom-0 left-0 w-full h-[30px] overflow-hidden opacity-60 pointer-events-none select-none">
          <motion.div 
            className="flex w-[200%]"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 15 }}
          >
            <svg width="100%" height="30" viewBox="0 0 500 30" preserveAspectRatio="none" className="stroke-brand-waveform fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0,20 L40,20 Q50,12 60,20 L70,20 L75,24 L82,2 L88,28 L93,20 L110,20 Q125,10 140,20 L290,20 Q300,12 310,20 L320,20 L325,24 L332,2 L338,28 L343,20 L360,20 Q375,10 390,20 L500,20" />
            </svg>
            <svg width="100%" height="30" viewBox="0 0 500 30" preserveAspectRatio="none" className="stroke-brand-waveform fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0,20 L40,20 Q50,12 60,20 L70,20 L75,24 L82,2 L88,28 L93,20 L110,20 Q125,10 140,20 L290,20 Q300,12 310,20 L320,20 L325,24 L332,2 L338,28 L343,20 L360,20 Q375,10 390,20 L500,20" />
            </svg>
          </motion.div>
        </div>

      </div>

      {/* Footer Label */}
      <div className="absolute bottom-8 text-light-text-secondary dark:text-dark-text-secondary text-[10px] tracking-[0.2em] uppercase font-bold opacity-40 text-center w-full pointer-events-none select-none">
        Platform Vers 4.2.0 &bull; Hardware Interface Layer
      </div>
    </div>
  );
}
