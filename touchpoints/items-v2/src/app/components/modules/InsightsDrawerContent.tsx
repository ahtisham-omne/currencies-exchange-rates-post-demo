import React from 'react';
import { motion } from 'framer-motion';
import { Check, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { baseMoney } from '@/app/currency/itemMoney';

interface Widget {
    id: string;
    label: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    type: 'kpi' | 'widget';
}

interface InsightsDrawerContentProps {
    widgets: Widget[];
    visibleWidgets: string[];
    onToggleWidget: (id: string) => void;
}

export const InsightsDrawerContent: React.FC<InsightsDrawerContentProps> = ({
    widgets,
    visibleWidgets,
    onToggleWidget
}) => {
    const kpiWidgets = widgets.filter(w => w.type === 'kpi');
    const complexWidgets = widgets.filter(w => w.type !== 'kpi');

    const getWidgetInfographic = (widgetId: string) => {
        switch (widgetId) {
            case 'widget-stock-health':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2">
                        <div className="h-2 w-full bg-[var(--secondary)] rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 w-[45%] bg-[var(--accent)]" />
                            <div className="absolute top-1/2 left-[45%] transform -translate-y-1/2 -translate-x-1/2 w-0.5 h-3 bg-[var(--accent)]" />
                        </div>
                        <div className="flex justify-between text-[9px] text-[var(--muted-foreground)] mt-1">
                            <span>Min</span>
                            <span>Max</span>
                        </div>
                    </div>
                );
            
            case 'widget-locations':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2">
                        <div className="flex items-end gap-1 h-8">
                            <div className="w-full bg-[var(--chart-2)]/30 rounded-t" style={{height: '100%'}} />
                            <div className="w-full bg-[var(--chart-2)]/50 rounded-t" style={{height: '70%'}} />
                            <div className="w-full bg-[var(--chart-2)]/70 rounded-t" style={{height: '35%'}} />
                            <div className="w-full bg-[var(--chart-2)] rounded-t" style={{height: '40%'}} />
                        </div>
                    </div>
                );
            
            case 'widget-top-customers':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <div className="h-1 w-full bg-[var(--chart-1)]/70 rounded" />
                            <span className="text-[9px] text-[var(--muted-foreground)] shrink-0">40%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-1 w-[75%] bg-[var(--chart-1)]/50 rounded" />
                            <span className="text-[9px] text-[var(--muted-foreground)] shrink-0">29%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-1 w-[35%] bg-[var(--chart-1)]/30 rounded" />
                            <span className="text-[9px] text-[var(--muted-foreground)] shrink-0">14%</span>
                        </div>
                    </div>
                );
            
            case 'widget-uom':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2 flex items-center justify-center">
                        <div className="relative w-12 h-12">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--chart-3)" strokeWidth="4" opacity="0.3" strokeDasharray="60 40" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--chart-4)" strokeWidth="4" opacity="0.5" strokeDasharray="25 75" strokeDashoffset="-60" />
                                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--chart-5)" strokeWidth="4" opacity="0.7" strokeDasharray="15 85" strokeDashoffset="-85" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-medium text-[var(--foreground)]">340</span>
                            </div>
                        </div>
                    </div>
                );
            
            case 'widget-activity':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2">
                        <div className="h-10 flex items-end gap-0.5">
                            {[30, 45, 35, 60, 50, 70, 55, 65, 75, 80, 70, 85].map((h, i) => (
                                <div key={i} className="flex-1 bg-[var(--accent)]/40 rounded-t" style={{height: `${h}%`}} />
                            ))}
                        </div>
                    </div>
                );
            
            case 'widget-primary-vendor':
                return (
                    <div className="bg-[var(--secondary)]/30 rounded p-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-5 w-5 rounded bg-[var(--secondary)] flex items-center justify-center text-[9px] text-[var(--muted-foreground)]">G</div>
                            <div className="flex-1 min-w-0">
                                <div className="h-1.5 w-20 bg-[var(--foreground)]/20 rounded mb-1" />
                                <div className="h-1 w-12 bg-[var(--foreground)]/10 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <div className="bg-[var(--background)]/50 rounded p-1">
                                <div className="h-1 w-8 bg-[var(--foreground)]/10 rounded mb-0.5" />
                                <div className="h-1.5 w-10 bg-[var(--foreground)]/20 rounded" />
                            </div>
                            <div className="bg-[var(--background)]/50 rounded p-1">
                                <div className="h-1 w-8 bg-[var(--foreground)]/10 rounded mb-0.5" />
                                <div className="h-1.5 w-10 bg-[var(--foreground)]/20 rounded" />
                            </div>
                        </div>
                    </div>
                );
            
            default:
                return null;
        }
    };

    const getWidgetDescription = (widgetId: string) => {
        switch (widgetId) {
            case 'widget-stock-health': return 'Inventory levels & trends';
            case 'widget-top-customers': return '5 top purchasing customers';
            case 'widget-primary-vendor': return 'Top supplier information';
            case 'widget-locations': return 'Top 4 stock locations';
            case 'widget-uom': return 'Unit of measure breakdown';
            case 'widget-activity': return 'Transaction trend chart';
            default: return '';
        }
    };

    const getKPIValue = (widgetId: string) => {
        switch (widgetId) {
            case 'kpi-open-po': return '3';
            case 'kpi-open-so': return '5';
            case 'kpi-last-price': return baseMoney(24.5);
            case 'kpi-lead-time': return '14';
            default: return '';
        }
    };

    return (
        <div className="overflow-y-auto h-[calc(100vh-88px)] px-6 py-6">
            {/* KPI Metrics Section */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[var(--muted-foreground)]" />
                    <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Key Metrics</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {kpiWidgets.map(widget => {
                        const isActive = visibleWidgets.includes(widget.id);
                        return (
                            <motion.div
                                key={widget.id}
                                className={cn(
                                    "group relative rounded-lg border cursor-pointer overflow-hidden transition-colors",
                                    "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/10"
                                )}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => onToggleWidget(widget.id)}
                            >
                                {/* Checkmark indicator */}
                                <div className="absolute top-2 right-2 z-10">
                                    <div className={cn(
                                        "h-4 w-4 rounded-full border flex items-center justify-center transition-all",
                                        isActive 
                                            ? "bg-[var(--primary)] border-[var(--primary)]" 
                                            : "bg-transparent border-[var(--border)] group-hover:border-[var(--foreground)]/20"
                                    )}>
                                        {isActive && <Check size={10} className="text-[var(--primary-foreground)]" />}
                                    </div>
                                </div>
                                
                                {/* Mini KPI Preview */}
                                <div className="p-4">
                                    <div className="flex items-start gap-2 mb-3">
                                        <div className="p-1 rounded bg-[var(--secondary)]">
                                            {widget.icon && <widget.icon size={10} className="text-[var(--muted-foreground)]" />}
                                        </div>
                                        <p className="text-[10px] text-[var(--muted-foreground)] leading-tight uppercase tracking-wide mt-0.5">{widget.label}</p>
                                    </div>
                                    <div className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
                                        {getKPIValue(widget.id)}
                                    </div>
                                    {widget.id === 'kpi-lead-time' && <span className="text-[10px] text-[var(--muted-foreground)]">Days</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Analytics Widgets Section */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-[var(--muted-foreground)]" />
                    <h3 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Analytics</h3>
                </div>
                <div className="space-y-3">
                    {complexWidgets.map(widget => {
                        const isActive = visibleWidgets.includes(widget.id);
                        
                        return (
                            <motion.div
                                key={widget.id}
                                className={cn(
                                    "group relative rounded-lg border cursor-pointer overflow-hidden transition-colors",
                                    "border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/10"
                                )}
                                whileHover={{ y: -1 }}
                                onClick={() => onToggleWidget(widget.id)}
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded bg-[var(--secondary)]">
                                                {widget.icon && <widget.icon size={12} className="text-[var(--muted-foreground)]" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-[var(--foreground)]">{widget.label}</p>
                                                <p className="text-[10px] text-[var(--muted-foreground)]">
                                                    {getWidgetDescription(widget.id)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "h-4 w-4 rounded-full border flex items-center justify-center transition-all shrink-0",
                                            isActive 
                                                ? "bg-[var(--primary)] border-[var(--primary)]" 
                                                : "bg-transparent border-[var(--border)] group-hover:border-[var(--foreground)]/20"
                                        )}>
                                            {isActive && <Check size={10} className="text-[var(--primary-foreground)]" />}
                                        </div>
                                    </div>
                                    {/* Mini Infographic */}
                                    {getWidgetInfographic(widget.id)}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
