import { FiUsers, FiPlus, FiTrash2 } from "react-icons/fi";
import api from "../api/api";

export default function GroupList({
  groups,
  activeGroup,
  onSelect,
  onRefresh, // 🔥 reload groups after add/delete
  onCreateClick // 🔥 open create UI
}) {

  const deleteGroup = async (groupId) => {
    if (!confirm("Delete this group?")) return;

    try {
      await api.delete(`/contact-groups/${groupId}`);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete group", err);
      alert("Failed to delete group");
    }
  };

  return (
    <div className="bg-white rounded-[12px] border shadow-lg p-5 space-y-4">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FiUsers className="text-blue-600" />
          Contact Groups
        </h3>

        {/* ADD GROUP */}
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <FiPlus /> Add
        </button>
      </div>

      {/* EMPTY */}
      {groups.length === 0 && (
        <div className="text-sm text-slate-500">
          No groups created yet
        </div>
      )}

      {/* GROUP LIST */}
      <div className="space-y-2">
        {groups.map((g) => {
          const active = activeGroup?._id === g._id;

          return (
            <div
              key={g._id}
              className={`group flex items-center justify-between px-4 py-3 rounded-[12px] border transition cursor-pointer
                ${
                  active
                    ? "bg-blue-50 border-blue-400 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                    : "hover:bg-slate-50"
                }`}
            >
              {/* GROUP INFO */}
              <div onClick={() => onSelect(g)} className="flex-1">
                <div className="font-medium text-slate-900">
                  {g.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {g.contactIds?.length || 0} contacts
                </div>
              </div>

              {/* DELETE */}
              <button
                onClick={() => deleteGroup(g._id)}
                className="opacity-0 group-hover:opacity-100 transition text-red-500 hover:text-red-600"
                title="Delete group"
              >
                <FiTrash2 />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
