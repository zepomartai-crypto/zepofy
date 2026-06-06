import { useEffect, useState } from "react";
import api from "../api/api";
import { FiUsers } from "react-icons/fi";

export default function GroupSidebar({ activeGroup, onSelect }) {
  const [groups, setGroups] = useState([]);

  const loadGroups = async () => {
    const res = await api.get("/contact-groups");
    setGroups(res.data.groups || []);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div className="bg-white border rounded-[12px] shadow p-4 space-y-2">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FiUsers /> Groups
      </h3>

      {groups.length === 0 && (
        <div className="text-sm text-gray-500">No groups created</div>
      )}

      {groups.map((g) => (
        <button
          key={g._id}
          onClick={() => onSelect(g)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
            activeGroup?._id === g._id
              ? "bg-blue-50 border-blue-400"
              : "hover:bg-gray-50"
          }`}
        >
          <div className="font-medium">{g.name}</div>
          <div className="text-xs text-gray-500">
            {g.contactIds.length} contacts
          </div>
        </button>
      ))}
    </div>
  );
}
