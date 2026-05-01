import { useState } from 'react';
import { Bell, Settings, ChevronDown, FileText, CreditCard, ShoppingCart, Package, Users, BarChart3, Home, HelpCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
  activeView: 'invoices' | 'prepayments' | 'receiving' | 'payments';
  onViewChange: (view: 'invoices' | 'prepayments' | 'receiving' | 'payments') => void;
}

export function Layout({ children, activeView, onViewChange }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="h-12 bg-white text-gray-900 flex items-center justify-between px-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#2563eb] rounded flex items-center justify-center text-sm font-bold text-white">
              O
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="hover:text-gray-900 cursor-pointer">Accounting</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Invoices</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 h-8 w-8 p-0 rounded-full">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 h-8 w-8 p-0 rounded-full">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-full px-3 py-1.5 ml-1">
            <div className="w-7 h-7 bg-[#2563eb] rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-white">AA</span>
            </div>
            <div className="text-xs">
              <div className="font-medium text-gray-900">Ahtisham Ahmad</div>
              <div className="text-[10px] text-gray-500">Controller</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
          <nav className="p-3 space-y-1 flex-1">
            <NavItem icon={<Home />} label="Dashboard" />
            <NavItem icon={<BarChart3 />} label="Accounting" active>
              <SubNavItem label="Invoices" active />
              <SubNavItem label="Bills" />
              <SubNavItem label="Payments" />
              <SubNavItem label="Journal Entries" />
            </NavItem>
            <NavItem icon={<ShoppingCart />} label="Procurement" />
            <NavItem icon={<Package />} label="Inventory" />
            <NavItem icon={<FileText />} label="Sales Orders" />
            <NavItem icon={<Users />} label="People" />
            <NavItem icon={<CreditCard />} label="Assets" />
          </nav>
          
          <div className="p-3 m-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-gray-600" />
              <div className="text-xs font-medium text-gray-700">Help & Support</div>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-gray-300">
              Contact Support
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-gray-50 flex flex-col">
          {/* Top Level Tabs */}
          <div className="px-6 bg-white border-b border-gray-200 flex items-center">
            <button
              onClick={() => onViewChange('invoices')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'invoices'
                  ? 'text-[#2563eb] border-b-2 border-[#2563eb] -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Invoices
            </button>
            <button
              onClick={() => onViewChange('prepayments')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'prepayments'
                  ? 'text-[#2563eb] border-b-2 border-[#2563eb] -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Vendor Prepayments
            </button>
            <button
              onClick={() => onViewChange('receiving')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'receiving'
                  ? 'text-[#2563eb] border-b-2 border-[#2563eb] -mb-[2px]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-4 h-4" />
              Receiving Documents
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  children?: React.ReactNode;
}

function NavItem({ icon, label, active, children }: NavItemProps) {
  const [expanded, setExpanded] = useState(active);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active 
            ? 'bg-blue-50 text-blue-600' 
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {children && (
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
          />
        )}
      </button>
      {children && expanded && (
        <div className="ml-7 mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

interface SubNavItemProps {
  label: string;
  active?: boolean;
}

function SubNavItem({ label, active }: SubNavItemProps) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
        active 
          ? 'bg-blue-50 text-blue-600 font-medium' 
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}