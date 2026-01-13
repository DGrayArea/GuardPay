
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CreditCard, 
  Wallet, 
  BarChart2, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();

  const navItems = [
    { 
      icon: <LayoutDashboard size={20} />, 
      label: "Dashboard", 
      path: "/dashboard" 
    },
    {
      icon: <LinkIcon size={20} />, 
      label: "Payment Links", 
      path: "/dashboard/links"
    },
    { 
      icon: <CreditCard size={20} />, 
      label: "Payments", 
      path: "/dashboard/payments" 
    },
    { 
      icon: <Wallet size={20} />, 
      label: "Wallet", 
      path: "/dashboard/wallet" 
    },
    { 
      icon: <BarChart2 size={20} />, 
      label: "Analytics", 
      path: "/dashboard/analytics" 
    },
    { 
      icon: <Settings size={20} />, 
      label: "Settings", 
      path: "/dashboard/settings" 
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        "bg-gray-900 text-white transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo area */}
        <div className="flex items-center h-16 px-4 border-b border-gray-800">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-md bg-web3-skyBlue flex items-center justify-center">
              <Wallet size={16} className="text-web3-blue" />
            </div>
            {!collapsed && <span className="font-semibold">GuardPay</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2.5 rounded-md transition-colors",
                  isActive 
                    ? "bg-gray-800 text-white" 
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 w-10 mx-auto mb-4 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Profile section */}
        <div className={cn(
          "border-t border-gray-800 p-4",
          collapsed ? "items-center justify-center" : ""
        )}>
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "space-x-3"
          )}>
            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
              <User size={16} className="text-gray-300" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-medium">Merchant Account</p>
                <p className="text-xs text-gray-400">
                    {user?.address ? `${user.address.slice(0,6)}...${user.address.slice(-4)}` : 'Not Connected'}
                </p>
              </div>
            )}
          </div>
          
          {!collapsed && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4 text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={logout}
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
