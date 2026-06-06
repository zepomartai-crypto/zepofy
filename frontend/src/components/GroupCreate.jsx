import { useState } from "react";
import api from "../api/api";

export default function GroupCreate({ onCreated }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name.trim()) return alert("Group name required");

    try {
      setLoading(true);
      await api.post("/contact-groups", { name });
      setName("");
      onCreated();
    } catch {
      alert("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[12px] border shadow-lg p-6 flex flex-col md:flex-row gap-4 items-end">

      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Create New Group
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. VIP Customers"
          className="w-full border rounded-[12px] px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        onClick={create}
        disabled={loading}
        className="bg-indigo-600 text-white px-6 py-2.5 rounded-[12px] font-semibold shadow hover:bg-indigo-700 transition disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Group"}
      </button>
    </div>
  );
}
