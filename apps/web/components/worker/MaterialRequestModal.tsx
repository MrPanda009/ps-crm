"use client";

import { useState } from "react";
import { X, Package, Plus, Trash2 } from "lucide-react";

interface Material {
  id: string;
  name: string;
  unit: string;
  available: number;
}

const MOCK_INVENTORY: Material[] = [
  { id: "1", name: "LED Street Bulb", unit: "pcs", available: 50 },
  { id: "2", name: "Water Pipe 2\"", unit: "meters", available: 100 },
  { id: "3", name: "Electrical Wire", unit: "meters", available: 200 },
  { id: "4", name: "Manhole Cover", unit: "pcs", available: 10 },
];

interface RequestItem {
  materialId: string;
  quantity: number;
}

interface MaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketTitle: string;
}

export default function MaterialRequestModal({
  isOpen,
  onClose,
  ticketId,
  ticketTitle,
}: MaterialRequestModalProps) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const addItem = () => {
    setItems([...items, { materialId: MOCK_INVENTORY[0].id, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSuccess(true);
    
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setItems([]);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#161616] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2a2a2a] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Request Materials</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">For Ticket: {ticketId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-[#1e1e1e] rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 bg-gray-50 dark:bg-[#1e1e1e] p-2 rounded-lg border border-gray-100 dark:border-[#2a2a2a]">
              {ticketTitle}
            </p>
          </div>

          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 mb-6">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-end p-3 rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/50 dark:bg-[#1a1a1a]">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>
                  <select
                    value={item.materialId}
                    onChange={(e) => updateItem(index, "materialId", e.target.value)}
                    className="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    {MOCK_INVENTORY.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.available} {m.unit} available)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-[#2a2a2a] rounded-xl">
                <p className="text-sm text-gray-400">No materials added yet</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  + Add Material
                </button>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add another item
            </button>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={items.length === 0 || isSubmitting || isSuccess}
              className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                isSuccess
                  ? "bg-green-500 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : isSuccess ? (
                "Request Sent!"
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
