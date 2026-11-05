import React from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Layers, 
  ClipboardCheck, 
  ArrowRightLeft, 
  RefreshCw, 
  MapPin, 
  Plus, 
  Truck,
  ArrowRight,
  ShoppingCart,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Types for our cards
interface HubCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  color?: string;
  action?: string;
  delay?: number;
  onClick?: () => void;
}

const HubCard = ({ title, description, icon: Icon, color = "text-foreground", action, delay = 0, onClick }: HubCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="h-full"
    onClick={onClick}
  >
    <div className="group h-full flex flex-col bg-card border border-border/60 hover:border-primary/30 rounded-xl transition-all duration-300 hover:shadow-elevation-sm cursor-pointer p-6 relative overflow-hidden">
      <div className="flex items-start justify-between mb-5">
        <div className={cn("p-3 rounded-xl bg-secondary/50 group-hover:bg-primary/5 transition-colors", color)}>
          <Icon size={24} strokeWidth={1.5} />
        </div>
        {action && (
          <div className="flex items-center text-xs font-medium text-base-second/50 group-hover:text-primary transition-colors">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-1">{action}</span>
            <ArrowRight size={14} className="-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 duration-300" />
          </div>
        )}
      </div>
      
      <div className="mt-auto">
        <h3 className="text-lg font-medium text-foreground mb-2 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm font-normal text-base-second line-clamp-2 leading-relaxed">{description}</p>
      </div>
    </div>
  </motion.div>
);

const ActionCard = ({ title, description, icon: Icon, colorClass, delay = 0, onClick }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="h-full"
    onClick={onClick}
  >
    <div className="group flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card hover:bg-secondary/20 hover:border-border transition-all cursor-pointer h-full">
         <div className={cn("p-2 rounded-lg bg-secondary/30 mt-0.5", colorClass)}>
            <Icon size={18} />
         </div>
         <div>
            <h3 className="text-sm font-medium text-foreground mb-1 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-xs font-normal text-base-second leading-relaxed">{description}</p>
         </div>
    </div>
  </motion.div>
);

interface ModuleGridProps {
  onNavigate?: (moduleName: string) => void;
}

export function ModuleGrid({ onNavigate }: ModuleGridProps) {
  return (
    <div className="space-y-8">
      
      {/* Main Section: Modules Hub */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
             <h2 className="text-sm font-normal text-base-second uppercase tracking-wider">Modules</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard 
            title="Items Library" 
            description="Centralized master data for all items, SKUs, and variants."
            icon={Package}
            color="text-indigo-500"
            action="Open"
            delay={0.1}
            onClick={() => onNavigate?.('items-library')}
          />
          <HubCard 
            title="Categories" 
            description="Organize items into families, groups, and tax classes."
            icon={Layers}
            color="text-pink-500"
            action="Open"
            delay={0.15}
            onClick={() => onNavigate?.('categories')}
          />
          <HubCard 
            title="Physical Inventory" 
            description="Full-scale stock taking and reconciliation records."
            icon={ClipboardCheck}
            color="text-cyan-500"
            action="Open"
            delay={0.2}
            onClick={() => onNavigate?.('physical-inventory')}
          />
           <HubCard 
            title="Inventory Movement" 
            description="Track transfers, adjustments, and inbound/outbound history."
            icon={ArrowRightLeft}
            color="text-purple-500"
            action="Open"
            delay={0.25}
            onClick={() => onNavigate?.('inventory-movement')}
          />
           <HubCard 
            title="Cycle Count" 
            description="Schedule and manage periodic partial stock counts."
            icon={RefreshCw}
            color="text-orange-500"
            action="Open"
            delay={0.3}
            onClick={() => onNavigate?.('cycle-count')}
          />
          <HubCard 
            title="Locations Management" 
            description="Configure warehouse zones, aisles, racks, and bins."
            icon={MapPin}
            color="text-slate-500"
            action="Open"
            delay={0.35}
            onClick={() => onNavigate?.('locations-management')}
          />
          <HubCard 
            title="Qualified Vendors" 
            description="Manage approved vendor relationships with lead times and priorities."
            icon={ShoppingCart}
            color="text-green-500"
            action="Open"
            delay={0.4}
            onClick={() => onNavigate?.('qualified-vendors')}
          />
          <HubCard 
            title="Sales Overview" 
            description="Track revenue, orders, and performance metrics with insights."
            icon={TrendingUp}
            color="text-emerald-500"
            action="Open"
            delay={0.45}
            onClick={() => onNavigate?.('sales-overview')}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommended Actions - Now Secondary */}
        <section className="lg:col-span-2">
            <h2 className="text-sm font-normal text-base-second mb-4 uppercase tracking-wider pl-1">Recommended Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionCard 
                title="Add New Item" 
                description="Create item & assign to warehouse."
                icon={Plus}
                colorClass="text-blue-600 dark:text-blue-400"
                delay={0.4}
                onClick={() => onNavigate?.('item-creation')}
            />
            <ActionCard 
                title="Process Inbound" 
                description="Review pending stock transfers."
                icon={Truck}
                colorClass="text-emerald-600 dark:text-emerald-400"
                delay={0.45}
            />
            <ActionCard 
                title="Start Cycle Count" 
                description="Initiate count for Warehouse A."
                icon={ClipboardCheck}
                colorClass="text-amber-600 dark:text-amber-400"
                delay={0.5}
            />
            </div>
        </section>

        {/* Recent Activity */}
        <section className="lg:col-span-1">
             <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-sm font-normal text-base-second uppercase tracking-wider">Activity</h2>
                <button className="text-xs text-primary hover:underline">View All</button>
            </div>
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden divide-y divide-border/40">
            {[
                { text: 'Inbound Shipment #4029', time: '2h ago' },
                { text: 'Stock Adj: "Ergo Chair"', time: '4h ago' },
                { text: 'New Vendor: TechParts', time: '1d ago' }
            ].map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">{item.text}</span>
                    </div>
                    <span className="text-xs text-base-second font-normal flex-shrink-0 ml-2">{item.time}</span>
                </div>
            ))}
            </div>
        </section>
      </div>

    </div>
  );
}