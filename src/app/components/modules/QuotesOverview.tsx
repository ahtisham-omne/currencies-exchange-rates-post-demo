import React from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    Eye,
    UserCircle2,
    MapPin
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';
import { cn } from '../../../lib/utils';

// Mock sparkline data generator
const generateSparklinePoints = (trend: 'up' | 'down' | 'volatile', points = 12) => {
    const data: number[] = [];
    let value = 50;
    
    for (let i = 0; i < points; i++) {
        if (trend === 'up') {
            value += Math.random() * 10 - 3;
        } else if (trend === 'down') {
            value += Math.random() * 5 - 8;
        } else {
            value += Math.random() * 20 - 10;
        }
        data.push(Math.max(20, Math.min(80, value)));
    }
    return data;
};

const MiniSparkline: React.FC<{ data: number[]; color: string; trend: 'up' | 'down' }> = ({ data, color, trend }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 18;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="60" height="20" viewBox="0 0 60 20" className="inline-block ml-2">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

interface KPICardProps {
    label: string;
    value: string;
    change: string;
    isPositive: boolean;
    sparklineData: number[];
    sparklineTrend: 'up' | 'down' | 'volatile';
    subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, change, isPositive, sparklineData, sparklineTrend, subtitle }) => {
    const changeColor = isPositive ? 'var(--accent)' : 'var(--destructive)';
    const sparklineColor = sparklineTrend === 'up' ? 'var(--accent)' : sparklineTrend === 'down' ? 'var(--destructive)' : 'var(--chart-1)';
    
    return (
        <Card className="border-[var(--border)] bg-[var(--card)]">
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
                        <p className="text-2xl font-semibold text-[var(--foreground)] mb-1 tracking-tight">{value}</p>
                        {subtitle && (
                            <p className="text-[10px] text-[var(--muted-foreground)]">{subtitle}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <MiniSparkline data={sparklineData} color={sparklineColor} trend={sparklineTrend === 'down' ? 'down' : 'up'} />
                        <div className="flex items-center gap-1 mt-1">
                            {sparklineTrend === 'up' ? (
                                <TrendingUp size={10} style={{ color: changeColor }} />
                            ) : (
                                <TrendingDown size={10} style={{ color: changeColor }} />
                            )}
                            <span className="text-[10px] font-medium" style={{ color: changeColor }}>
                                {change}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Placeholder mock data - will be replaced with real data
const mockQuotesKPIs = [
    {
        label: 'Active Quotes',
        value: '24',
        change: '+12%',
        isPositive: true,
        sparklineData: generateSparklinePoints('up'),
        sparklineTrend: 'up' as const,
        subtitle: '3 expiring soon'
    },
    {
        label: 'Total Quote Value',
        value: '$482,500',
        change: '+18%',
        isPositive: true,
        sparklineData: generateSparklinePoints('up'),
        sparklineTrend: 'up' as const,
        subtitle: 'This month'
    },
    {
        label: 'Conversion Rate',
        value: '68%',
        change: '+5%',
        isPositive: true,
        sparklineData: generateSparklinePoints('up'),
        sparklineTrend: 'up' as const,
        subtitle: 'Last 30 days'
    },
    {
        label: 'Avg. Quote Value',
        value: '$20,104',
        change: '-3%',
        isPositive: false,
        sparklineData: generateSparklinePoints('down'),
        sparklineTrend: 'down' as const,
        subtitle: 'This quarter'
    }
];

interface Quote {
    id: string;
    quoteNumber: string;
    customerName: string;
    customerInitials: string;
    customerColor: string;
    status: string;
    quoteValue: string;
    lineItem: number;
    poc: string;
    pocInitials: string;
    pocColor: string;
    customerDeliveryLocation: string;
    salesRep: string;
    requestedOn: string;
    createdOn: string;
    respondBy: string;
    confirmationDate?: string;
    validUntil: string;
}

const mockQuotes: Quote[] = [
    {
        id: '1',
        quoteNumber: 'QT-2026-1001',
        customerName: 'Precision Parts Ltd.',
        customerInitials: 'PP',
        customerColor: 'bg-purple-500/10 text-purple-600 border-purple-200',
        status: 'Active',
        quoteValue: '$45,850',
        lineItem: 12,
        poc: 'Kevin Moore',
        pocInitials: 'KM',
        pocColor: 'bg-green-500/10 text-green-600 border-green-200',
        customerDeliveryLocation: 'Los Angeles, CA',
        salesRep: 'James Rodriguez',
        requestedOn: '2026-01-10',
        createdOn: '2026-01-10',
        respondBy: '2026-01-24',
        confirmationDate: '2026-01-15',
        validUntil: '2026-02-10',
    },
    {
        id: '2',
        quoteNumber: 'QT-2026-1002',
        customerName: 'MegaCorp Inc.',
        customerInitials: 'MI',
        customerColor: 'bg-blue-500/10 text-blue-600 border-blue-200',
        status: 'Pending Review',
        quoteValue: '$32,150',
        lineItem: 8,
        poc: 'Jim Harris',
        pocInitials: 'JH',
        pocColor: 'bg-green-500/10 text-green-600 border-green-200',
        customerDeliveryLocation: 'New York, NY',
        salesRep: 'David Park',
        requestedOn: '2026-01-12',
        createdOn: '2026-01-13',
        respondBy: '2026-01-27',
        validUntil: '2026-02-13',
    },
    {
        id: '3',
        quoteNumber: 'QT-2026-1003',
        customerName: 'BuildIt Construction',
        customerInitials: 'BC',
        customerColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
        status: 'Expiring Soon',
        quoteValue: '$67,890',
        lineItem: 15,
        poc: 'Robert Clark',
        pocInitials: 'RC',
        pocColor: 'bg-red-500/10 text-red-600 border-red-200',
        customerDeliveryLocation: 'Chicago, IL',
        salesRep: 'Emily Chen',
        requestedOn: '2026-01-05',
        createdOn: '2026-01-06',
        respondBy: '2026-01-20',
        confirmationDate: '2026-01-08',
        validUntil: '2026-01-25',
    },
    {
        id: '4',
        quoteNumber: 'QT-2026-1004',
        customerName: 'Acme Corporation',
        customerInitials: 'AC',
        customerColor: 'bg-amber-500/10 text-amber-600 border-amber-200',
        status: 'Converted',
        quoteValue: '$28,400',
        lineItem: 6,
        poc: 'Andy Brown',
        pocInitials: 'AB',
        pocColor: 'bg-green-500/10 text-green-600 border-green-200',
        customerDeliveryLocation: 'Austin, TX',
        salesRep: 'James Rodriguez',
        requestedOn: '2025-12-20',
        createdOn: '2025-12-21',
        respondBy: '2026-01-04',
        confirmationDate: '2025-12-28',
        validUntil: '2026-01-21',
    },
    {
        id: '5',
        quoteNumber: 'QT-2026-1005',
        customerName: 'Tech Solutions Group',
        customerInitials: 'TS',
        customerColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
        status: 'Active',
        quoteValue: '$54,720',
        lineItem: 10,
        poc: 'Lisa Martinez',
        pocInitials: 'LM',
        pocColor: 'bg-green-500/10 text-green-600 border-green-200',
        customerDeliveryLocation: 'Seattle, WA',
        salesRep: 'Michael Brown',
        requestedOn: '2026-01-15',
        createdOn: '2026-01-16',
        respondBy: '2026-01-30',
        validUntil: '2026-02-16',
    },
];

const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
            return 'bg-green-500/10 text-green-600 border-green-200';
        case 'pending review':
            return 'bg-amber-500/10 text-amber-600 border-amber-200';
        case 'expiring soon':
            return 'bg-red-500/10 text-red-600 border-red-200';
        case 'converted':
            return 'bg-blue-500/10 text-blue-600 border-blue-200';
        case 'expired':
            return 'bg-gray-500/10 text-gray-600 border-gray-200';
        default:
            return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
};

export function QuotesOverview() {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockQuotesKPIs.map((kpi, index) => (
                    <KPICard key={index} {...kpi} />
                ))}
            </div>

            {/* Quotes Table */}
            <Card className="border-[var(--border)] bg-[var(--card)]">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border [&>th]:h-8">
                                    {[
                                        "Quick View","Quote No","Customer Name","Status","Quote Value","Line Item",
                                        "Point of Contact","Customer Delivery Location","Sales Rep","Requested On",
                                        "Created On","Respond By","Confirmation Date","Valid Until",
                                    ].map((label) => (
                                        <TableHead key={label} className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                                            {label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockQuotes.map((quote) => (
                                    <TableRow 
                                        key={quote.id}
                                        className="border-b border-border/60 cursor-pointer transition-colors hover:bg-[#F0F7FF]"
                                    >
                                        <TableCell className="w-12">
                                            <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                                                <Eye size={16} />
                                            </button>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 rounded-full border-2 border-[var(--primary)] flex items-center justify-center">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                                                </div>
                                                <span className="text-[13px] font-medium text-primary">{quote.quoteNumber}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn("h-6 w-6 rounded-full p-0 flex items-center justify-center text-[10px] font-medium border", quote.customerColor)}
                                                >
                                                    {quote.customerInitials}
                                                </Badge>
                                                <span className="text-[13px] text-foreground">{quote.customerName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant="outline" 
                                                className={cn("text-xs border", getStatusBadgeStyle(quote.status))}
                                            >
                                                {quote.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] font-medium text-foreground">{quote.quoteValue}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] text-foreground">{quote.lineItem}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn("h-5 w-5 rounded-full p-0 flex items-center justify-center text-[9px] font-medium border", quote.pocColor)}
                                                >
                                                    {quote.pocInitials}
                                                </Badge>
                                                <span className="text-[13px] text-foreground">{quote.poc}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={12} className="text-[var(--muted-foreground)]" />
                                                <span className="text-[13px] text-foreground">{quote.customerDeliveryLocation}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-5 w-5 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                                                    <UserCircle2 size={10} className="text-[var(--primary)]" />
                                                </div>
                                                <span className="text-[13px] text-foreground">{quote.salesRep}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] text-muted-foreground">{quote.requestedOn}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] text-muted-foreground">{quote.createdOn}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] text-muted-foreground">{quote.respondBy}</span>
                                        </TableCell>
                                        <TableCell>
                                            {quote.confirmationDate ? (
                                                <span className="text-[13px] text-muted-foreground">{quote.confirmationDate}</span>
                                            ) : (
                                                <span className="text-[13px] text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-[13px] text-muted-foreground">{quote.validUntil}</span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}