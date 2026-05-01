import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, File, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { toast } from 'sonner';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordCount: number;
  recordType: 'invoice' | 'prepayment' | 'payment';
}

export function ExportDialog({
  open,
  onOpenChange,
  recordCount,
  recordType
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf'>('excel');
  const [includeLineItems, setIncludeLineItems] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    
    // Simulate export process
    setTimeout(() => {
      setIsExporting(false);
      onOpenChange(false);
      
      toast.success('Export started', {
        description: `Preparing ${recordCount} ${recordType}${recordCount > 1 ? 's' : ''} for download...`
      });

      // Simulate download completion
      setTimeout(() => {
        toast.success('Export complete', {
          description: `${recordType.charAt(0).toUpperCase() + recordType.slice(1)}s exported successfully to ${exportFormat.toUpperCase()}.`,
          action: {
            label: 'Download',
            onClick: () => {
              toast.info('Download started');
            }
          }
        });
      }, 2000);
    }, 1000);
  };

  const formatOptions = [
    {
      value: 'excel',
      label: 'Excel Workbook',
      description: 'Full data with formatting (.xlsx)',
      icon: FileSpreadsheet,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50'
    },
    {
      value: 'csv',
      label: 'CSV File',
      description: 'Comma-separated values (.csv)',
      icon: FileText,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50'
    },
    {
      value: 'pdf',
      label: 'PDF Document',
      description: 'Formatted report (.pdf)',
      icon: File,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                Export {recordType.charAt(0).toUpperCase() + recordType.slice(1)}s
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-gray-600">
                Export {recordCount} selected {recordType}{recordCount > 1 ? 's' : ''} with customizable options
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Format Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Export Format</Label>
            <RadioGroup value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <div className="space-y-2">
                {formatOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        exportFormat === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setExportFormat(option.value as any)}
                    >
                      <div className={`p-2 ${option.iconBg} rounded`}>
                        <Icon className={`w-4 h-4 ${option.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                      <RadioGroupItem value={option.value} />
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Export Options */}
          {recordType === 'invoice' && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Include Additional Data</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    checked={includeLineItems}
                    onCheckedChange={(checked) => setIncludeLineItems(checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Line Items</div>
                    <div className="text-xs text-gray-500">Include detailed line item breakdown</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    checked={includePayments}
                    onCheckedChange={(checked) => setIncludePayments(checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Payment History</div>
                    <div className="text-xs text-gray-500">Include all payment transactions</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    checked={includeAttachments}
                    onCheckedChange={(checked) => setIncludeAttachments(checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Attachments</div>
                    <div className="text-xs text-gray-500">Include invoice documents (PDF only)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                Exporting <strong>{recordCount}</strong> {recordType}{recordCount > 1 ? 's' : ''} to{' '}
                <strong>{exportFormat.toUpperCase()}</strong>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
