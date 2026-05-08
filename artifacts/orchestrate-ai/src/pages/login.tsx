import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const ACCESS_CODE_LENGTH = 8;

export default function Login() {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { login } = useAppStore();
  const [, navigate] = useLocation();

  const progress = useMemo(
    () => Math.min(100, Math.round((accessCode.trim().length / ACCESS_CODE_LENGTH) * 100)),
    [accessCode],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    window.setTimeout(() => {
      if (login(accessCode)) {
        setError('');
        navigate('/');
        return;
      }
      setAttempts(value => value + 1);
      setError('That access code is not recognized.');
      setIsSubmitting(false);
    }, 280);
  };

  const featureRows = [
    { icon: Network, title: 'Agent routing', text: 'Career, code, study, vision, and planning agents in one workspace.' },
    { icon: Brain, title: 'Persistent memory', text: 'Local long-term context, agent-private notes, and session recall.' },
    { icon: ShieldCheck, title: 'Private control', text: 'Your API keys, models, and settings stay under your control.' },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="hero-mesh absolute inset-0 opacity-80" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex flex-col justify-between border-r border-border/60 px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl btn-gradient-primary shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">OrchestrateAI</div>
              <div className="text-xs text-muted-foreground">Multi-agent intelligence workspace</div>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              <LockKeyhole className="h-3.5 w-3.5" />
              Private workspace access
            </div>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight">
              One secure door into your AI operating system.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Enter the workspace code to unlock model routing, memory-aware agents, provider controls, and your saved conversations.
            </p>
          </div>

          <div className="grid gap-3">
            {featureRows.map(item => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/35 p-4 backdrop-blur-sm">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl btn-gradient-primary shadow-lg shadow-primary/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">OrchestrateAI</div>
                <div className="text-xs text-muted-foreground">Private AI workspace</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Authentication</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use your access code to continue into OrchestrateAI.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <input className="hidden" autoComplete="username" value="orchestrateai-user" readOnly />

                <div className="space-y-2">
                  <label htmlFor="access-code" className="text-xs font-semibold uppercase text-muted-foreground">
                    Access code
                  </label>
                  <div className="relative">
                    <Input
                      id="access-code"
                      type={showCode ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoFocus
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value);
                        setError('');
                      }}
                      placeholder="Enter workspace code"
                      aria-invalid={!!error}
                      className={`h-12 rounded-xl border-border/70 bg-background/65 pr-12 text-base tracking-[0.18em] placeholder:tracking-normal focus-visible:ring-primary/40 ${
                        error ? 'border-red-500/60 focus-visible:ring-red-500/40' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(value => !value)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                      aria-label={showCode ? 'Hide access code' : 'Show access code'}
                    >
                      {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${error ? 'bg-red-400' : 'bg-primary'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {error ? (
                    <p className="text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-200">
                      {error} {attempts >= 2 ? 'Check the code and try again.' : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Protected workspace session. Access is restored on this browser after a successful sign-in.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !accessCode.trim()}
                  className="h-12 w-full rounded-xl btn-gradient-primary text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Verifying...' : 'Unlock Workspace'}
                  {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-foreground/[0.025] px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Local settings
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-foreground/[0.025] px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
                  API-key ready
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
