
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import RequireAuth from "@/components/providers/RequireAuth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Payment from "./pages/Payment";
import Login from "./pages/Login";
import Invoice from "./pages/Invoice";
import Escrow from "./pages/Escrow";
import NotFound from "./pages/NotFound";

const App = () => (
  <Web3Provider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pay/:id" element={<Payment />} />
            <Route path="/invoice/:id" element={<Invoice />} />
            <Route path="/escrow" element={<Escrow />} />
            
            {/* Protected Routes */}
            <Route element={<RequireAuth />}>
              <Route path="/dashboard/*" element={<Dashboard />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </Web3Provider>
);

export default App;
