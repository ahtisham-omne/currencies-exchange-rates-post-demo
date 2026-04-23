import React from 'react';
import { SalesOverview } from './SalesOverview';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Sales Overview Page
 * 
 * This component can be integrated into the ItemDetail.tsx as a new tab
 * or used as a standalone page.
 * 
 * To add to ItemDetail.tsx:
 * 1. Import: import { SalesOverview } from './SalesOverview';
 * 2. Add to tabs array: { id: 'sales', label: 'Sales', icon: ShoppingCart }
 * 3. Add TabsContent: <TabsContent value="sales"><SalesOverview /></TabsContent>
 */

interface SalesOverviewPageProps {
    onBack?: () => void;
}

export const SalesOverviewPage: React.FC<SalesOverviewPageProps> = ({ onBack }) => {
    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="mb-6 flex items-center gap-4">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                        <ArrowLeft size={16} />
                    </Button>
                )}
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Sales Overview</h1>
                    <p className="text-sm text-[var(--muted-foreground)]">Track revenue, orders, and performance metrics</p>
                </div>
            </div>
            <SalesOverview />
        </div>
    );
};