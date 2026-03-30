import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";

interface AuthPageProps {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function AuthPage({ onLogin, onRegister, isLoading, error }: AuthPageProps) {
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const passwordMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return confirmPassword === password;
  }, [confirmPassword, password]);

  const serverErrorMessage =
    typeof error === "string" ? error : "An error occurred";

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!/[A-Za-z]/.test(pwd)) {
      return "Password must contain at least one letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (tab === "signin") {
      onLogin(email.trim(), password);
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      setLocalError(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    onRegister(email.trim(), password);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4" style={{ backgroundImage: "radial-gradient(circle at center, rgba(99,102,241,0.06), transparent 50%)" }}>
      <div className="w-full max-w-[420px]">
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-10">
          <div className="flex items-center gap-3 mb-2">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#6366f1]" fill="currentColor"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zm0 2.3L6 7.3v5.4l6 3.4 6-3.4V7.3l-6-3z" /></svg>
            <span className="text-white font-bold text-xl">AdaptiveTrader</span>
          </div>
          <p className="text-[#94a3b8] text-[13px]">AI-Powered Trading Platform</p>

          <div className="mt-6 relative border-b border-[#1e1e2e] grid grid-cols-2">
            <button className={tab === "signin" ? "py-3 text-white" : "py-3 text-[#475569]"} onClick={() => setTab("signin")}>Sign In</button>
            <button className={tab === "register" ? "py-3 text-white" : "py-3 text-[#475569]"} onClick={() => setTab("register")}>Create Account</button>
            <div className="absolute bottom-0 h-[2px] w-1/2 bg-[#6366f1] transition-all duration-150" style={{ transform: tab === "signin" ? "translateX(0%)" : "translateX(100%)" }} />
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <InputField icon={<Mail size={16} />} type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
            <InputField icon={<Lock size={16} />} type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={setPassword} right={
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-[#475569] hover:text-[#94a3b8]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            } />

            {tab === "signin" && (
              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-[#94a3b8]"><input type="checkbox" className="rounded" />Remember me</label>
                <button type="button" className="text-[#6366f1] hover:text-[#4f46e5]">Forgot password?</button>
              </div>
            )}

            {tab === "register" && (
              <>
                <InputField
                  icon={<Lock size={16} />}
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  className={passwordMatch == null ? "" : passwordMatch ? "border-[#22c55e]" : "border-[#ef4444]"}
                />
                <p className="text-[12px] text-[#475569] text-center">By creating an account you agree to our Terms</p>
              </>
            )}

            {(localError || error) && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '16px' }}>✕</span>
                <span>
                  {localError ?? serverErrorMessage}
                </span>
              </div>
            )}

            <button disabled={isLoading} type="submit" className="w-full h-11 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white font-medium transition-all duration-150">
              {isLoading ? "Loading..." : tab === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[#94a3b8] text-[13px]">
          <Shield size={14} className="text-[#22c55e]" />
          <span>Paper trading — no real money at risk</span>
        </div>
      </div>
    </div>
  );
}

interface InputFieldProps {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  right?: React.ReactNode;
  className?: string;
}

function InputField({ icon, type, placeholder, value, onChange, right, className = "" }: InputFieldProps) {
  return (
    <div className={["h-11 flex items-center gap-2 px-3 rounded-lg bg-[#0d0d14] border border-[#1e1e2e] focus-within:border-[#6366f1] focus-within:ring-4 focus-within:ring-[rgba(99,102,241,0.15)]", className].join(" ")}>
      <span className="text-[#475569]">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-[#f1f5f9] placeholder:text-[#475569]"
        placeholder={placeholder}
      />
      {right}
    </div>
  );
}
