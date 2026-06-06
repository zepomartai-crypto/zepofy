import { useState } from "react";
import api from "../../api/api";

export default function GroupCreateModal({ onClose, onCreated }) {
  const [name, setName] = useState("");

  const create = async () => {
    if (!name.trim()) return;
    await api.post("/contact-groups", { name });
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-[12px] p-6 w-[420px] space-y-4">
        <h3 className="text-lg font-semibold">Create Group</h3>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="w-full border rounded-lg px-4 py-2"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={create}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
