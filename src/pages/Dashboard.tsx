import { useEffect, useMemo, useState } from 'react';
import NotebookGrid from '@/components/dashboard/NotebookGrid';
import EmptyDashboard from '@/components/dashboard/EmptyDashboard';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, loading: authLoading, error: authError } = useAuth();
  const { notebooks, isLoading, error, isError } = useNotebooks();
  const [firstName, setFirstName] = useState('there');
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const hasNotebooks = (notebooks?.length ?? 0) > 0;

  useEffect(() => {
    if (!user?.id) {
      setFirstName('there');
      setIsProfileLoading(false);
      return;
    }

    let isMounted = true;

    const fetchProfile = async () => {
      setIsProfileLoading(true);

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      const profileName = data?.full_name?.trim();
      const emailName = user.email?.split('@')[0]?.trim();
      const resolvedName = profileName || emailName || 'there';

      setFirstName(resolvedName.split(' ')[0]);
      setIsProfileLoading(false);
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.email, user?.id]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }, []);

  if (authLoading || isProfileLoading) {
    return (
      <div className="min-h-screen bg-background px-6 py-24 text-foreground">
        <div className="mx-auto max-w-7xl">
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-saffron)]"></div>
            <p className="text-muted-foreground">Initializing dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background px-6 py-24 text-foreground">
        <div className="mx-auto max-w-7xl py-16 text-center">
          <p className="text-red-600">Authentication error: {authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-[var(--color-saffron)] px-4 py-2 text-white hover:bg-[color:rgba(232,137,12,0.9)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-6 py-24 text-foreground">
        <main className="mx-auto max-w-7xl">
          <header className="mb-10">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-2 text-5xl text-foreground">
              {greeting}, {firstName}.
            </h1>
          </header>
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-saffron)]"></div>
            <p className="text-muted-foreground">Loading your notebooks...</p>
          </div>
        </main>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="min-h-screen bg-background px-6 py-24 text-foreground">
        <main className="mx-auto max-w-7xl">
          <header className="mb-10">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-2 text-5xl text-foreground">
              {greeting}, {firstName}.
            </h1>
          </header>
          <div className="py-16 text-center">
            <p className="text-red-600">Error loading notebooks: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-[var(--color-saffron)] px-4 py-2 text-white hover:bg-[color:rgba(232,137,12,0.9)]"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-24 text-foreground">
      <main className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-2 text-5xl text-foreground">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-2 text-muted-foreground">Pick up where you left off and continue your learning flow.</p>
        </header>

        {hasNotebooks ? <NotebookGrid /> : <EmptyDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;
