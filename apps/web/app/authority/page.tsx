"use client";

import { useEffect, useState } from "react";
import MapComponent from "../MapComponent";
import { supabase } from "../../src/lib/supabase";

type Complaint = {
  id: string;
  title: string;
  severity: string;
  status: string;
};

export default function AuthorityDashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState("");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  useEffect(() => {
    fetchComplaints();
  }, []);

  async function fetchComplaints() {
    const { data, error } = await supabase
      .from("complaints")
      .select("id, title, severity, status");

    if (error) {
      console.error(error);
      return;
    }

    setComplaints(data || []);
  }
const filteredComplaints = complaints.filter((c) =>
  c.title.toLowerCase().includes(search.toLowerCase()) ||
  c.id.toLowerCase().includes(search.toLowerCase()) ||
  c.status.toLowerCase().includes(search.toLowerCase()) ||
  c.severity.toLowerCase().includes(search.toLowerCase())
);
  return (
    <div className="p-6 space-y-8">

      {/* TOP NAVBAR */}
      <div className="bg-[#5b3a2e] text-white px-6 py-4 rounded-lg flex justify-between items-center shadow-md">

        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">
            Civic Complaint Management
          </h1>

          <span className="text-sm opacity-80">
            Authority Dashboard
          </span>
        </div>

        <div className="flex items-center gap-4">

          <input
  placeholder="Search complaints..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="px-3 py-2 rounded-md text-black text-sm"
/>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>

            <div className="text-sm">
              Authority Lead
            </div>
          </div>

        </div>

      </div>

      {/* MAP CARD */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">

        <div className="flex justify-between items-center p-4 border-b bg-gray-50">

          <div className="flex gap-4 text-sm font-medium">

            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Low
            </span>

            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              Medium
            </span>

            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
              High
            </span>

            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              Critical
            </span>

          </div>

          <button className="px-4 py-2 bg-black text-white rounded-md text-sm">
            Map View
          </button>

        </div>

        <div className="h-[450px]">
         <MapComponent selectedComplaintId={selectedComplaintId} />
        </div>

      </div>

      {/* COMPLAINTS TABLE CARD */}
      <div className="bg-[#eef3f4] rounded-xl shadow-lg p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">

          <h2 className="text-lg font-semibold">
            Complaints Overview
          </h2>

          <div className="flex gap-3">

            <input type="text"
            placeholder="Search"
            value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="border rounded-md px-3 py-2 text-sm"
         />     

            <button className="px-3 py-2 border rounded-md text-sm">
              Filter
            </button>

            <button className="px-3 py-2 bg-gray-800 text-white rounded-md text-sm">
              Export
            </button>

          </div>

        </div>

        {/* TABLE */}
        <div className="bg-white rounded-lg overflow-hidden shadow">

          <table className="w-full text-sm">

            <thead className="bg-gradient-to-r from-[#5b3a2e] to-[#8b5e49] text-white">
              <tr>
                <th className="p-3 text-left">Ticket ID</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Severity</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredComplaints.map((c) => (
                <tr key={c.id}
                onClick={() => setSelectedComplaintId(c.id)}
                className="border-t hover:bg-gray-50 cursor-pointer transition">

                  <td className="p-3">{c.id}</td>

                  <td className="p-3">{c.title}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold
                        ${
                          c.severity === "Low"
                            ? "bg-green-100 text-green-700"
                            : ""
                        }
                        ${
                          c.severity === "Medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : ""
                        }
                        ${
                          c.severity === "High"
                            ? "bg-orange-100 text-orange-700"
                            : ""
                        }
                        ${
                          c.severity === "Critical"
                            ? "bg-red-100 text-red-700"
                            : ""
                        }
                      `}
                    >
                      {c.severity}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className="px-3 py-1 rounded-full bg-gray-200 text-xs">
                      {c.status}
                    </span>
                  </td>

                  <td className="p-3 flex gap-3 text-sm">

                    <button className="text-blue-600 hover:underline">
                      View
                    </button>

                    <button className="text-gray-700 hover:underline">
                      Edit
                    </button>

                    <button className="text-red-600 hover:underline">
                      Delete
                    </button>

                  </td>

                </tr>
              ))}
{filteredComplaints.length === 0 && (
  <tr>
    <td colSpan={5} className="text-center p-6 text-gray-500">
      No complaints found
    </td>
  </tr>
)}
            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}