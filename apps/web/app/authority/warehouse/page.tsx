"use client";

import { useState } from "react";
import { 
  Package, 
  Search, 
  Plus, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Inventory
} from "lucide-react";

interface WarehouseItem {
  id: string;
  name: string;
  category: string;
  available: number;
  unit: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

interface MaterialRequest {
  id: string;
  workerName: string;
  ticketId: string;
  items: { name: string; quantity: number; unit: string }[];
  status: "pending" | "approved" | "rejected";
  timestamp: string;
}

const MOCK_ITEMS: WarehouseItem[] = [
  { id: "1", name: "LED Street Bulb", category: "Electrical", available: 50, unit: "pcs", status: "In Stock" },
  { id: "2", name: "Water Pipe 2\"", category: "Plumbing", available: 5, unit: "meters", status: "Low Stock" },
  { id: "3", name: "Electrical Wire", category: "Electrical", available: 200, unit: "meters", status: "In Stock" },
  { id: "4", name: "Manhole Cover", category: "Civil", available: 0, unit: "pcs", status: "Out of Stock" },
  { id: "5", name: "Patching Bitumen", category: "Roads", available: 15, unit: "bags", status: "Low Stock" },
];

const MOCK_REQUESTS: MaterialRequest[] = [
  {
    id: "REQ-001",
    workerName: "Suresh Kumar",
    ticketId: "DL-2026-0042",
    items: [{ name: "LED Street Bulb", quantity: 2, unit: "pcs" }],
    status: "pending",
    timestamp: "2026-03-27T10:30:00Z",
  },
  {
    id: "REQ-002",
    workerName: "Ramesh Singh",
    ticketId: "DL-2026-0045",
    items: [{ name: "Water Pipe 2\"", quantity: 10, unit: "meters" }],
    status: "pending",
    timestamp: "2026-03-27T11:15:00Z",
  },
];

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<"inventory" | "requests">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState(MOCK_REQUESTS);

  const handleAction = (id: string, action: "approve" | "reject") => {
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req
    ));
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">124</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-xl">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Requests</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{requests.filter(r => r.status === "pending").length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-xl">
              <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock Alert</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">3 Items</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm overflow-hidden">
        {/* Header/Tabs */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-gray-100 dark:bg-[#1e1e1e] p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "inventory" ? "bg-white dark:bg-[#2a2a2a] text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "requests" ? "bg-white dark:bg-[#2a2a2a] text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Material Requests
              {requests.filter(r => r.status === "pending").length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                  {requests.filter(r => r.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-64 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-0">
          {activeTab === "inventory" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#1e1e1e] border-b border-gray-100 dark:border-[#2a2a2a]">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                  {MOCK_ITEMS.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-gray-500">ID: {item.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 rounded-md text-xs">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {item.available} {item.unit}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.status === "In Stock" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                          item.status === "Low Stock" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#1e1e1e] border-b border-gray-100 dark:border-[#2a2a2a]">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Materials</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{req.workerName}</div>
                        <div className="text-xs text-gray-500">{new Date(req.timestamp).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        {req.items.map((item, i) => (
                          <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                            {item.quantity} {item.unit} x {item.name}
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">
                        {req.ticketId}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          req.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" :
                          req.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        }`}>
                          {req.status === "approved" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : 
                           req.status === "rejected" ? <XCircle className="w-3 h-3 mr-1" /> : 
                           <Clock className="w-3 h-3 mr-1" />}
                          {req.status.charAt(0) + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {req.status === "pending" ? (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleAction(req.id, "approve")}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-all shadow-sm shadow-green-600/20"
                            >
                              Allot
                            </button>
                            <button 
                              onClick={() => handleAction(req.id, "reject")}
                              className="px-3 py-1 border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
