import { useState } from 'react';
import { Star, Plus, X, Edit3, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';

interface SavedView {
  id: string;
  name: string;
  filters: any;
  isDefault: boolean;
}

interface SavedViewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: any;
  onApplyView: (filters: any) => void;
}

export function SavedViewsDialog({
  open,
  onOpenChange,
  currentFilters,
  onApplyView
}: SavedViewsDialogProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([
    {
      id: '1',
      name: 'Pending Approval Queue',
      filters: { statuses: ['Pending Approval', 'Matched'], types: [], createdBy: [], dateFrom: '', dateTo: '' },
      isDefault: true
    },
    {
      id: '2',
      name: 'Exception Invoices',
      filters: { statuses: ['Exception', 'Payment Hold'], types: [], createdBy: [], dateFrom: '', dateTo: '' },
      isDefault: false
    },
    {
      id: '3',
      name: 'This Month PO-based',
      filters: { 
        statuses: [], 
        types: ['PO-based'], 
        createdBy: [], 
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0]
      },
      isDefault: false
    }
  ]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) {
      toast.error('View name required', {
        description: 'Please enter a name for this view.'
      });
      return;
    }

    const newView: SavedView = {
      id: Date.now().toString(),
      name: newViewName,
      filters: currentFilters,
      isDefault: false
    };

    setSavedViews([...savedViews, newView]);
    setNewViewName('');
    setShowSaveForm(false);
    toast.success('View saved', {
      description: `"${newViewName}" has been saved to your views.`
    });
  };

  const handleDeleteView = (id: string) => {
    const view = savedViews.find(v => v.id === id);
    setSavedViews(savedViews.filter(v => v.id !== id));
    toast.success('View deleted', {
      description: `"${view?.name}" has been removed.`
    });
  };

  const handleSetDefault = (id: string) => {
    setSavedViews(savedViews.map(v => ({
      ...v,
      isDefault: v.id === id
    })));
    const view = savedViews.find(v => v.id === id);
    toast.success('Default view set', {
      description: `"${view?.name}" is now your default view.`
    });
  };

  const handleApplyView = (view: SavedView) => {
    onApplyView(view.filters);
    onOpenChange(false);
    toast.success('View applied', {
      description: `Filters from "${view.name}" have been applied.`
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Saved Views</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Save and manage filter combinations for quick access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Saved views list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {savedViews.map((view) => (
              <div
                key={view.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <button
                  onClick={() => handleSetDefault(view.id)}
                  className={`flex-shrink-0 ${
                    view.isDefault ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${view.isDefault ? 'fill-current' : ''}`} />
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{view.name}</h4>
                    {view.isDefault && (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Object.values(view.filters).some(v => Array.isArray(v) ? v.length > 0 : v)
                      ? 'Custom filters applied'
                      : 'No filters'}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleApplyView(view)}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:text-red-600"
                    onClick={() => handleDeleteView(view.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Save current view form */}
          {showSaveForm ? (
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium">Save Current Filters</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter view name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCurrentView();
                  }}
                />
                <Button onClick={handleSaveCurrentView} size="sm">
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSaveForm(false);
                    setNewViewName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSaveForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Save Current Filters as View
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
