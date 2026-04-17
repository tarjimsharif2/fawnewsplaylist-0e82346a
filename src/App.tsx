import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Match from "./pages/Match.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    if ((window as { Clappr?: unknown }).Clappr) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-clappr-player="true"]'
    );

    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@clappr/player@latest/dist/clappr.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.clapprPlayer = 'true';
    document.head.appendChild(script);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/match/:slug" element={<Match />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
