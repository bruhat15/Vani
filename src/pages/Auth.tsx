import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RippleButton } from "@/components/ui/ripple-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WaveMark from "@/components/ui/WaveMark";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const subtitle = useMemo(() => {
    return isLogin
      ? "Sign in to continue your notebook sessions"
      : "Create your account to start voice-first learning";
  }, [isLogin]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Welcome back",
          description: "You are now signed in.",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Account created",
          description: "Check your email for a confirmation link before signing in.",
        });

        setIsLogin(true);
      }
    } catch (error) {
      toast({
        title: isLogin ? "Sign in failed" : "Sign up failed",
        description: error instanceof Error ? error.message : "Authentication request failed.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-navy)] px-4 py-16 text-[var(--color-paper)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(232,137,12,0.2),_transparent_55%)]" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-md rounded-3xl border border-[color:rgba(232,232,240,0.28)] bg-[color:rgba(245,240,232,0.08)] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.28)] backdrop-blur-[20px] md:p-8">
        <div className="mb-7 text-center">
          <div className="mb-4 flex justify-center">
            <WaveMark className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-4xl">Vani</h1>
          <p className="text-sm text-[color:rgba(245,240,232,0.78)]">{subtitle}</p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.form
            key={isLogin ? "login" : "signup"}
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onSubmit={handleSubmit}
          >
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[var(--color-paper)]">
                  Full name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  className="border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--color-paper)]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--color-paper)]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                className="border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                required
              />
            </div>

            <RippleButton
              type="submit"
              className="mt-2 w-full bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]"
              disabled={loading}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </RippleButton>
          </motion.form>
        </AnimatePresence>

        <button
          type="button"
          className="mt-5 w-full text-sm text-[color:rgba(245,240,232,0.85)] transition-colors hover:text-[var(--color-paper)]"
          onClick={() => setIsLogin((previous) => !previous)}
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
};

export default Auth;