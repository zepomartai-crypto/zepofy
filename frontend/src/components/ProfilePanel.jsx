// src/components/ProfilePanel.jsx
import React from "react";

const Row = ({ label, value }) => (
  <div className="mb-2">
    <div className="text-xs text-gray-400">{label}</div>
    <div className="font-medium">{value || "—"}</div>
  </div>
);

export default function ProfilePanel({ activeCustomer }) {
  return (
    <div className="w-80 bg-white border-l p-6">
      {!activeCustomer ? (
        <div className="text-gray-500 text-center mt-20">Select a customer to view profile</div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="w-20 h-20 rounded-full bg-blue-400 flex items-center justify-center text-white text-2xl font-bold">
              {activeCustomer.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="text-lg font-bold">{activeCustomer.name}</div>
            <div className="text-sm text-gray-500">{activeCustomer.phone}</div>
          </div>

          <div className="space-y-3">
            <Row label="Status" value={activeCustomer.status || "Active"} />
            <Row label="Last Active" value={activeCustomer.lastActive} />
            <Row label="Tags" value={(activeCustomer.tags || []).join(", ")} />
            <Row label="Source" value={activeCustomer.source || "MANUAL"} />
          </div>

          <div className="mt-6">
            <button className="w-full border rounded px-4 py-2 mb-2">Start Flow</button>
            <button className="w-full border rounded px-4 py-2">Transfer</button>
          </div>
        </>
      )}
    </div>
  );
}
