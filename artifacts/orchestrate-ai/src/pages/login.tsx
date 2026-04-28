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
      <Card className="w-full max-w-md z-10 border-white/5 bg-card/50 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out">
        <CardHeader className="space-y-3 text-center pb-6">
          <div
            className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/30 animate-in fade-in zoom-in-50 duration-500"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle
            className="text-3xl font-semibold tracking-tight text-white animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            OrchestrateAI
          </CardTitle>
          <CardDescription
            className="text-muted-foreground text-base animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: '260ms', animationFillMode: 'both' }}
          >
            Enter your access code to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: '340ms', animationFillMode: 'both' }}
          >
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
                className={`bg-black/20 border-white/10 text-center text-lg h-12 transition-all duration-300 ${error ? 'border-red-500/50 focus-visible:ring-red-500/50' : 'focus-visible:ring-primary/50 focus-visible:border-primary/50'}`}
              />
              {error && <p className="text-sm text-red-400 text-center animate-in fade-in slide-in-from-top-1 duration-300">Invalid access code</p>}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30"
            >
              Access Workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}