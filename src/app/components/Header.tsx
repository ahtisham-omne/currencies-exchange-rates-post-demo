import React from 'react';
import { Search, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

export function Header() {
  return (
    <header className="flex items-center justify-between mb-8 w-full py-4">
      {/* Title */}
      <div>
        <motion.div
           initial={{ opacity: 0, y: -5 }}
           animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Items & Inventory
          </h1>
          <p className="text-base-second text-sm font-normal mt-1">
            Manage your catalog, stock levels, and warehouse operations.
          </p>
        </motion.div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-second group-hover:text-foreground transition-colors" />
          <input
            type="text"
            placeholder="Search modules..."
            className="pl-9 pr-4 py-2 w-[240px] bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-normal transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button className="p-2 hover:bg-secondary rounded-full transition-colors text-base-second hover:text-foreground relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
        </button>
        
        <div className="h-8 w-[1px] bg-border mx-1" />

        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm border border-primary/20">
            JS
          </div>
        </div>
      </div>
    </header>
  );
}
