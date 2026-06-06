import { FiUsers, FiTrash2, FiEdit, FiEye } from "react-icons/fi";
import api from "../../api/api";

export default function GroupTable({ groups, onRefresh, onEdit, onViewContacts }) {

  const del = async (id) => {
    if (!window.confirm("Delete this group permanently?")) return;

    try {
      await api.delete(`/contact-groups/${id}`);

      // ✅ IMMEDIATELY REFRESH UI
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete group");
    }
  };

  return (
    <div className="bg-white rounded-[12px] shadow border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="p-4 text-left">Group</th>
            <th className="p-4 text-center">Leads</th>
            <th className="p-4 text-left">Created</th>
            <th className="p-4 text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {groups.map((g) => (
            <tr key={g._id} className="border-t hover:bg-slate-50">

              {/* GROUP */}
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <FiUsers />
                  </div>

                  <div>
                    <div className="font-medium text-slate-800">
                      {g.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Group ID: {g._id.slice(-6)}
                    </div>
                  </div>
                </div>
              </td>

              {/* COUNT */}
              <td className="p-4 text-center">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {g.contactIds?.length || 0}
                </span>
              </td>

              {/* DATE */}
              <td className="p-4 text-slate-500">
                {new Date(g.createdAt).toLocaleDateString()}
              </td>

              {/* ACTION */}
              <td className="p-4 text-center space-x-2">
                <button
                  onClick={() => onViewContacts(g)}
                  className="p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                  title="View Contacts"
                >
                  <FiEye />
                </button>

                <button
                  onClick={() => onEdit(g)}
                  className="p-2 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  title="Edit Group"
                >
                  <FiEdit />
                </button>

                <button
                  onClick={() => del(g._id)}
                  className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                  title="Delete Group"
                >
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}

          {groups.length === 0 && (
            <tr>
              <td colSpan="4" className="p-12 text-center text-slate-400">
                No groups found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
