
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AppProviders } from "@/app/AppProviders";
import AppShell from "@/app/AppShell";

const App = () => (
  <AppProviders>
    <Toaster />
    <Sonner />
    <AppShell />
  </AppProviders>
);

export default App;
