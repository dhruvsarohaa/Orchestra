import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { login } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(password)) {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
      <Card className="w-full max-w-md z-10 border-white/5 bg-card/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight text-white">OrchestrateAI</CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Enter your access code to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <input className="hidden" autoComplete="username" value="orchestrateai-user" readOnly />
              <Input
                type="password"
                placeholder="Access Code"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                className={`bg-black/20 border-white/10 text-center text-lg h-12 ${error ? 'border-red-500/50 focus-visible:ring-red-500/50' : 'focus-visible:ring-primary/50'}`}
              />
              {error && <p className="text-sm text-red-400 text-center animate-in fade-in slide-in-from-top-1">Invalid access code</p>}
            </div>
            <Button type="submit" className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Access Workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}