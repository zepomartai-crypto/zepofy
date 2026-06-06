import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiUsers, FiPlus } from "react-icons/fi";
import api from "../../api/api";
import { toast } from "react-hot-toast";

export default function AddToGroupModal({ open, onClose, selectedContactIds, onAdded, selectAll = false, filters = {} }) {
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (open) {
            loadGroups();
            setNewGroupName("");
            setSelectedGroupId("");
        }
    }, [open]);

    const loadGroups = async () => {
        try {
            const res = await api.get("/contact-groups");
            setGroups(res.data.groups || []);
        } catch (err) {
            console.error("Failed to load groups:", err);
        }
    };

    const handleAddToExisting = async () => {
        if (!selectedGroupId) return alert("Please select a group");

        setLoading(true);
        try {
            const res = await api.post("/groups/add-contacts", {
                groupId: selectedGroupId,
                contactIds: selectedContactIds,
                selectAll,
                filters
            });
            toast.success(res.data.message || `Contacts added successfully`);
            onAdded?.();
            onClose();
        } catch (err) {
            console.error("Failed to add contacts to group:", err);
            toast.error(err.response?.data?.message || "Failed to add contacts to group");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newGroupName.trim()) return alert("Please enter a group name");

        setLoading(true);
        try {
            const res = await api.post("/groups/create-with-contacts", {
                groupName: newGroupName,
                contactIds: selectedContactIds,
                selectAll,
                filters
            });

            const newGroupId = res.data.group?._id;
            toast.success("Group created successfully");
            
            onAdded?.();
            onClose();

            if (newGroupId) {
                navigate(`/groups/${newGroupId}`);
            }
        } catch (err) {
            console.error("Failed to create and add contacts:", err);
            toast.error(err.response?.data?.message || "Failed to create and add contacts");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-md rounded-[12px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Contacts to Group</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                    >
                        <FiX size={20} />
                    </button>
                </div>
                <div className="mb-6">
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block">
                      {selectAll ? "All Matching Contacts" : `${selectedContactIds?.length || 0} Contacts Selected`}
                   </p>
                </div>

                <div className="space-y-8">
                    {/* Section 1: Existing Groups */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
                            <FiUsers className="text-blue-600" />
                            Transfer to Existing Group
                        </h4>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Select Existing Group
                            </label>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="w-full rounded-[12px] border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
                            >
                                <option value="">-- Select Group --</option>
                                {groups.map((g) => (
                                    <option key={g._id} value={g._id}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            disabled={loading || !selectedGroupId}
                            onClick={handleAddToExisting}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[12px] font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? "Processing..." : "Confirm Transfer"}
                        </button>
                    </div>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">OR</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    {/* Section 2: Create New Group */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-800 border-b pb-2">Section 2 — Create New Group</h4>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Group Name
                            </label>
                            <input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Enter group name..."
                                className="w-full rounded-[12px] border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
                            />
                        </div>
                        <button
                            disabled={loading || !newGroupName.trim()}
                            onClick={handleCreateAndAdd}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-[12px] font-semibold shadow-[0px_4px_12px_rgba(0,0,0,0.05)] transition-all disabled:opacity-50"
                        >
                            Create & Add Contacts
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
