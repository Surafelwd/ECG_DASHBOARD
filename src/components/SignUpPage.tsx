import React, { useState } from 'react';
import { Moon, Sun, Eye, EyeOff, Activity, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export interface SignUpPageProps {
  onSignUpSubmit: (formData: any) => void;
  onReturnToLogin: () => void;
  onNavigateToLogin: () => void;
  initialRole: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  duplicateEmailError: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function SignUpPage({
  onSignUpSubmit,
  onReturnToLogin,
  onNavigateToLogin,
  initialRole,
  isLoading,
  isSuccess,
  duplicateEmailError,
  theme,
  toggleTheme
}: SignUpPageProps) {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    if (isSuccess) {
      setStep(3);
    }
  }, [isSuccess]);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    role: initialRole || '',
    employeeId: '',
    institutionName: ''
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep1 = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.termsAccepted) {
      errors.termsAccepted = 'You must accept the terms to continue';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.role) errors.role = 'Please select a role';
    if (!formData.employeeId.trim()) errors.employeeId = 'Employee ID is required';
    if (!formData.institutionName.trim()) errors.institutionName = 'Institution name is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      onSignUpSubmit(formData);
      // Advance to step 3 will be handled by the parent based on success/loading, 
      // but we can simulate it internally if not strictly controlled.
      // Wait, the prompt says step 3 is confirmation. Let's let the parent do it, 
      // or we can do it internally when isLoading changes from true to false?
      // For simplicity, let's just show Step 3 if we call submit and there is no error.
      // We will handle it with an internal state if parent doesn't control the step.
      // But the prompt says "Continue -> Step 3: Confirmation".
    }
  };

  // We can track successful submission here for step 3 if parent just returns success.
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleNext();
    } else if (step === 2) {
      if (validateStep2()) {
        // Here we just call the submit prop. We assume the parent will handle the network.
        // For preview purposes, we will set step 3 after a small delay to mock success,
        // or let the parent component trigger step 3 by some mechanism.
        // Since we don't have a success prop, let's just trigger step 3 here.
        onSignUpSubmit(formData);
        // We'll show step 3 if it's not loading and no duplicate email error.
        // Actually, we'll let a local effect handle moving to step 3 if loading finishes.
      }
    }
  };

  // Move to step 3 if loading is complete and we were on step 2 and no errors.
  // We'll use a slightly different approach: the parent component handles the API call.
  // To avoid complexity, we can pass a callback or just do it locally.

  const renderStep1 = () => (
    <div className="space-y-4">
      
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
          Full Name
        </label>
        <input 
          type="text"
          value={formData.fullName}
          onChange={(e) => handleChange('fullName', e.target.value)}
          className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.fullName ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow`}
          placeholder="John Doe"
        />
        {formErrors.fullName && <span className="text-brand-error text-[11px] block">{formErrors.fullName}</span>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
          Email Address
        </label>
        <input 
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.email ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow`}
          placeholder="email@example.com"
        />
        {formErrors.email && <span className="text-brand-error text-[11px] block">{formErrors.email}</span>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
          Phone Number
        </label>
        <input 
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.phone ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow`}
          placeholder="+1 (555) 000-0000"
        />
        {formErrors.phone && <span className="text-brand-error text-[11px] block">{formErrors.phone}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.password ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow pr-10`}
              placeholder="••••••••"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formErrors.password && <span className="text-brand-error text-[11px] block">{formErrors.password}</span>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            Confirm Password
          </label>
          <div className="relative">
            <input 
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.confirmPassword ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow pr-10`}
              placeholder="••••••••"
            />
            <button 
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formErrors.confirmPassword && <span className="text-brand-error text-[11px] block">{formErrors.confirmPassword}</span>}
        </div>
      </div>

      <div className="pt-2">
        <label className="flex items-start text-xs text-light-text-secondary dark:text-dark-text-secondary cursor-pointer">
          <input 
            type="checkbox" 
            checked={formData.termsAccepted}
            onChange={(e) => handleChange('termsAccepted', e.target.checked)}
            className={`mr-2 mt-0.5 w-4 h-4 rounded-sm border-gray-300 dark:border-dark-border text-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-card dark:bg-dark-bg cursor-pointer ${formErrors.termsAccepted ? 'border-brand-error' : ''}`}
          />
          <span className="leading-tight">I agree to the Terms of Service and Privacy Policy for the Device Monitoring Platform.</span>
        </label>
        {formErrors.termsAccepted && <span className="text-brand-error text-[11px] block mt-1">{formErrors.termsAccepted}</span>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="flex items-center text-sm font-semibold text-brand-primary cursor-pointer mb-2 w-max" onClick={() => setStep(1)}>
        <ArrowLeft size={16} className="mr-1" /> Back to Basic Info
      </div>
      
      <div className="space-y-3">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
          Select Role
        </label>
        
        <div 
          onClick={() => handleChange('role', 'administrator')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${formData.role === 'administrator' ? 'border-brand-primary bg-[#1B7A6E]/[0.08]' : 'border-gray-300 dark:border-dark-border hover:border-brand-primary/50'}`}
        >
          <div className="flex items-center mb-1">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${formData.role === 'administrator' ? 'border-brand-primary' : 'border-gray-400 dark:border-gray-500'}`}>
              {formData.role === 'administrator' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
            </div>
            <span className="font-semibold text-light-text dark:text-dark-text text-sm">Administrator</span>
          </div>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary ml-7">Manage devices, users, and system settings</p>
        </div>
        
        <div 
          onClick={() => handleChange('role', 'it_support')}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${formData.role === 'it_support' ? 'border-brand-primary bg-[#1B7A6E]/[0.08]' : 'border-gray-300 dark:border-dark-border hover:border-brand-primary/50'}`}
        >
          <div className="flex items-center mb-1">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${formData.role === 'it_support' ? 'border-brand-primary' : 'border-gray-400 dark:border-gray-500'}`}>
              {formData.role === 'it_support' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
            </div>
            <span className="font-semibold text-light-text dark:text-dark-text text-sm">IT / Device Support</span>
          </div>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary ml-7">Manage device connectivity, firmware, and diagnostics</p>
        </div>
        {formErrors.role && <span className="text-brand-error text-[11px] block">{formErrors.role}</span>}
      </div>

      {formData.role && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              Employee ID
            </label>
            <input 
              type="text"
              value={formData.employeeId}
              onChange={(e) => handleChange('employeeId', e.target.value)}
              className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.employeeId ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow`}
              placeholder="EMP-0000"
            />
            {formErrors.employeeId && <span className="text-brand-error text-[11px] block">{formErrors.employeeId}</span>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              Institution / Organization Name
            </label>
            <input 
              type="text"
              value={formData.institutionName}
              onChange={(e) => handleChange('institutionName', e.target.value)}
              className={`w-full px-4 py-3 bg-light-bg dark:bg-dark-bg border ${formErrors.institutionName ? 'border-brand-error focus:ring-brand-error' : 'border-gray-300 dark:border-dark-border focus:ring-brand-primary'} rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:ring-2 focus:border-transparent transition-shadow`}
              placeholder="Pulse Medical Systems"
            />
            {formErrors.institutionName && <span className="text-brand-error text-[11px] block">{formErrors.institutionName}</span>}
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center py-6">
      <div className="flex justify-center mb-6">
        <CheckCircle className="text-brand-primary w-16 h-16" />
      </div>
      <h2 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Registration Complete</h2>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-8 leading-relaxed max-w-sm mx-auto">
        Your account is under review. You'll receive an email once approved by an administrator.
      </p>
      <button 
        type="button"
        onClick={onReturnToLogin}
        className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 rounded-sm uppercase tracking-widest text-xs outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-card transition-colors cursor-pointer"
      >
        Return to Login
      </button>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-300">
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

      <div className="w-full max-w-[480px] relative bg-light-card dark:bg-dark-card rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-none border border-gray-300 dark:border-dark-border overflow-hidden flex flex-col">
        
        {duplicateEmailError && (
          <div className="bg-brand-error text-white py-2.5 px-4 text-xs font-bold flex items-center justify-center uppercase tracking-widest text-center z-10">
            <AlertCircle className="mr-2 shrink-0" size={14} />
            Email already in use
          </div>
        )}

        <div className="p-8 sm:p-10 pb-12 relative z-10">
          {step !== 3 && (
            <div className="mb-8">
              <div className="flex items-center mb-2">
                  <Activity className="text-brand-primary mr-2" size={24} />
                  <h1 className="text-xl font-bold text-light-text dark:text-dark-text uppercase tracking-tight">Pulse Monitoring</h1>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {step === 1 ? 'Create your account to manage the device fleet.' : 'Select your authorization role.'}
              </p>
              
              <div className="flex gap-2 mt-6">
                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-dark-border'}`} />
                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-dark-border'}`} />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            {step !== 3 && (
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 rounded-sm uppercase tracking-widest text-xs mt-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-card transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
              >
                {isLoading ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : 'Continue'}
              </button>
            )}
          </form>

          {step === 1 && (
            <div className="mt-6 text-center">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                Already have an account? <button type="button" onClick={onNavigateToLogin} className="text-brand-primary hover:underline font-semibold outline-none focus-visible:underline cursor-pointer">Log in</button>
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full h-[30px] overflow-hidden opacity-60 pointer-events-none select-none z-0">
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

      <div className="absolute bottom-8 text-light-text-secondary dark:text-dark-text-secondary text-[10px] tracking-[0.2em] uppercase font-bold opacity-40 text-center w-full pointer-events-none select-none">
        Platform Vers 4.2.0 &bull; Hardware Interface Layer
      </div>
    </div>
  );
}
