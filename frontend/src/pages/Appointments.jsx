import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/useAuth";
import toast from 'react-hot-toast';
import {
  FiCalendar, FiClock, FiUser, FiPhone, FiCheckCircle,
  FiXCircle, FiTrash2, FiFilter, FiRefreshCw, FiExternalLink,
  FiBell, FiSettings, FiCheck, FiSend
} from "react-icons/fi";
import { io } from "socket.io-client";
import Modal from "../components/UI/Modal";
import DensitySelector from "../components/UI/DensitySelector";
import { Activity } from "lucide-react";

export default function Appointments() {
  const { user } = useAuth();
  const location = useLocation();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    confirmationEnabled: true,
    confirmationMessage: "Hello {{patient_name}}, your appointment is confirmed for {{appointment_date}} at {{appointment_time}}.",
    reminderEnabled: true,
    reminderHoursBefore: 2,
    reminderMessage: "Hello {{patient_name}}, this is a reminder for your appointment on {{appointment_date}} at {{appointment_time}}."
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const socketRef = useRef(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/appointments${filter !== 'all' ? `?status=${filter}` : ''}`);
      if (res.data.success) {
        setAppointments(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch appointments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchReminderSettings = async () => {
    try {
      const res = await api.get('/whatsapp/settings');
      if (res.data.success && res.data.data?.appointments?.reminders) {
        setReminderSettings(prev => ({
          ...prev,
          ...res.data.data.appointments.reminders
        }));
      }
    } catch (err) {
      console.error("Failed to fetch reminder settings", err);
    }
  };

  const saveReminderSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await api.post('/whatsapp/settings', {
        appointments: {
          reminders: reminderSettings
        }
      });
      if (res.data.success) {
        toast.success("Reminder settings saved!");
        setIsSettingsModalOpen(false);
      }
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchReminderSettings();

    // 🔌 Socket Connection for Real-time Updates
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    socketRef.current = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("🔌 Connected to appointments socket");
      socketRef.current.emit("user_connect", user?._id);
    });

    // 🆕 New Booking
    socketRef.current.on("new_appointment", (newAppt) => {
      console.log("🆕 New appointment received via socket:", newAppt);
      setAppointments(prev => {
        if (prev.some(a => a._id === newAppt._id)) return prev;
        return [newAppt, ...prev];
      });
      toast.success(`New booking from ${newAppt.customerName}!`, { icon: '📅' });
    });

    // 🔄 Status/Data Update
    socketRef.current.on("appointment_updated", (updatedAppt) => {
      console.log("🔄 Appointment updated via socket:", updatedAppt);
      setAppointments(prev => prev.map(a => a._id === updatedAppt._id ? updatedAppt : a));

      // Update selected appointment if modal is open
      setSelectedAppointment(prev => prev?._id === updatedAppt._id ? updatedAppt : prev);
    });

    // 🚫 Cancelled (Specific event if needed, though updated covers it)
    socketRef.current.on("appointment_cancelled", ({ appointmentId }) => {
      setAppointments(prev => prev.map(a => a._id === appointmentId ? { ...a, status: 'cancelled' } : a));
    });

    // 🗑️ Deleted
    socketRef.current.on("appointment_deleted", (id) => {
      console.log("🗑️ Appointment deleted via socket:", id);
      setAppointments(prev => prev.filter(a => a._id !== id));
      if (selectedAppointment?._id === id) setIsDetailModalOpen(false);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user?._id, fetchAppointments, selectedAppointment?._id]);

  const updateStatus = async (id, status) => {
    try {
      const res = await api.patch(`/appointments/${id}/status`, { status });
      if (res.data.success) {
        toast.success(`Appointment marked as ${status}`);
        fetchAppointments();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const deleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const res = await api.delete(`/appointments/${id}`);
      if (res.data.success) {
        toast.success("Appointment deleted");
        fetchAppointments();
      }
    } catch (err) {
      toast.error("Failed to delete appointment");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-poppins selection:bg-blue-100">
      {/* Header Section */}
      <div className="px-6 py-6 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                <FiFilter size={16} />
              </div>
              <input
                type="text"
                placeholder="Search patient name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-blue-500/50 transition-all outline-none placeholder:text-slate-300 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black tracking-widest border border-blue-100/50 shadow-sm uppercase">
              <Activity size={12} className="animate-pulse" /> {appointments.length} Total Bookings
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['all', 'pending', 'scheduled', 'completed', 'cancelled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 h-9 rounded-lg text-xs font-bold transition-all capitalize ${filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <DensitySelector
              value={density}
              onChange={(val) => setDensity(val)}
              options={[
                { label: "Comfortable", value: "comfortable" },
                { label: "Compact", value: "compact" }
              ]}
              label=""
            />
            <div className="w-px h-8 bg-slate-200 mx-1"></div>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="h-11 px-5 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[12px] font-semibold tracking-wide hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm"
            >
              <FiBell size={16} className="text-blue-500" /> Reminders
            </button>
            <button
              onClick={fetchAppointments}
              className="h-11 w-11 flex items-center justify-center bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm"
            >
              <FiRefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-slate-500'} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6 animate-fadeIn">
          {[
            { label: 'Total Bookings', value: appointments.length, color: 'indigo', icon: <FiCalendar /> },
            { label: 'Pending', value: appointments.filter(a => a.status === 'pending').length, color: 'amber', icon: <FiClock /> },
            { label: 'Scheduled', value: appointments.filter(a => a.status === 'scheduled').length, color: 'blue', icon: <FiCheck /> },
            { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, color: 'emerald', icon: <FiCheckCircle /> },
            { label: 'Cancelled', value: appointments.filter(a => a.status === 'cancelled').length, color: 'red', icon: <FiXCircle /> },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-slate-200/60 shadow-sm rounded-2xl flex items-center gap-4 p-4 hover:scale-[1.02] hover:shadow-md transition-all duration-300 cursor-default group">
              <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center text-xl shrink-0 group-hover:rotate-6 transition-transform`}>
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">{stat.label}</p>
                <p className="text-xl font-bold text-slate-800 font-poppins">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] text-slate-600">
              <thead className="bg-slate-100/50 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Patient</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Date & Time</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Clinic</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Reminders</th>
                  <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments
                  .filter(a =>
                    a.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    a.customerPhone?.includes(searchTerm)
                  )
                  .length > 0 ? appointments
                    .filter(a =>
                      a.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      a.customerPhone?.includes(searchTerm)
                    )
                    .map((appt) => (
                      <tr key={appt._id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`${density === 'compact' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'} rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold`}>
                              {appt.customerName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-bold text-slate-800 ${density === 'compact' ? 'text-xs' : 'text-sm'} leading-tight`}>{appt.customerName}</p>
                              {density !== 'compact' && <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><FiPhone size={10} /> {appt.customerPhone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                          <div className={density === 'compact' ? 'flex items-center gap-3' : 'space-y-1'}>
                            <p className={`${density === 'compact' ? 'text-xs' : 'text-sm'} font-semibold text-slate-700 flex items-center gap-1.5`}>
                              <FiCalendar className="text-slate-400" size={14} /> {appt.appointmentDate}
                            </p>
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium uppercase">
                              <FiClock className="text-slate-300" size={14} /> {appt.appointmentTime}
                            </p>
                          </div>
                        </td>
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                          <span className={`${density === 'compact' ? 'text-xs' : 'text-sm'} text-slate-600 font-medium`}>{appt.clinicName}</span>
                        </td>
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                          <span className={`px-2.5 py-1 rounded-full ${density === 'compact' ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-widest border
                        ${appt.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              appt.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                appt.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  'bg-red-50 text-red-600 border-red-100'}`}>
                            {appt.status}
                          </span>
                        </td>
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${appt.confirmationReminderSent ? 'bg-emerald-500' : 'bg-slate-200'}`}
                              title={appt.confirmationReminderSent ? "Confirmation Sent" : "Confirmation Pending"}
                            />
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${appt.dayOfReminderSent || appt.reminderSent ? 'bg-blue-500' : 'bg-slate-200'}`}
                              title={appt.dayOfReminderSent || appt.reminderSent ? "Reminder Sent" : "Reminder Pending"}
                            />
                          </div>
                        </td>
                        <td className={`px-6 ${density === 'compact' ? 'py-2.5' : 'py-4'} text-center`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              title="View Details"
                            >
                              <FiExternalLink size={16} />
                            </button>
                            {(appt.status === 'pending' || appt.status === 'scheduled') && (
                              <>
                                {appt.status === 'pending' ? (
                                  <button
                                    onClick={() => updateStatus(appt._id, 'scheduled')}
                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Confirm Appointment"
                                  >
                                    <FiCheck size={16} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => updateStatus(appt._id, 'completed')}
                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Mark as Completed"
                                  >
                                    <FiCheckCircle size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => updateStatus(appt._id, 'cancelled')}
                                  className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                  title="Cancel Appointment"
                                >
                                  <FiXCircle size={16} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteAppointment(appt._id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-slate-500">
                      <FiCalendar size={32} className="mx-auto mb-3 opacity-20" />
                      No appointments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer - Consistency */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Appointments Registry • Page <span className="text-blue-600">01</span>
            </div>
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Total {appointments.length} Appointments Found
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Settings Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Automated Reminder Settings"
        size="md"
      >
        <div className="p-6 space-y-6">
          {/* Global Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div>
              <p className="font-bold text-slate-800">Enable Automated Reminders</p>
              <p className="text-xs text-slate-500">Global switch for all appointment notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={reminderSettings.enabled}
                onChange={(e) => setReminderSettings({ ...reminderSettings, enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className={`space-y-6 transition-all ${reminderSettings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Confirmation Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FiCheck className="text-emerald-500" /> Confirmation Message
                </label>
                <input
                  type="checkbox"
                  checked={reminderSettings.confirmationEnabled}
                  onChange={(e) => setReminderSettings({ ...reminderSettings, confirmationEnabled: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
              </div>
              <textarea
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none min-h-[80px]"
                placeholder="Message sent when appointment is approved..."
                value={reminderSettings.confirmationMessage}
                onChange={(e) => setReminderSettings({ ...reminderSettings, confirmationMessage: e.target.value })}
              />
            </div>

            {/* Reminder Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FiBell className="text-blue-500" /> Automated Reminder
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={reminderSettings.reminderHoursBefore || 2}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, reminderHoursBefore: parseInt(e.target.value) || 1 })}
                      className="w-10 bg-transparent text-center text-xs font-bold text-blue-600 outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-bold pr-2 uppercase">Hours Before</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminderSettings.reminderEnabled}
                    onChange={(e) => setReminderSettings({ ...reminderSettings, reminderEnabled: e.target.checked })}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                </div>
              </div>
              <textarea
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none min-h-[80px]"
                placeholder="Message sent to the patient..."
                value={reminderSettings.reminderMessage}
                onChange={(e) => setReminderSettings({ ...reminderSettings, reminderMessage: e.target.value })}
              />
              <p className="text-[10px] text-slate-400 italic">Use {"{{patient_name}}"}, {"{{appointment_date}}"}, {"{{appointment_time}}"} variables</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={saveReminderSettings}
              disabled={savingSettings}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
            >
              {savingSettings ? 'Saving...' : <><FiCheck /> Save Settings</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Appointment Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Appointment Details"
        size="md"
      >
        {selectedAppointment && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-100">
                  {selectedAppointment.customerName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedAppointment.customerName}</h3>
                  <p className="text-slate-500 flex items-center gap-2 mt-1 font-medium">
                    <FiPhone className="text-blue-500" /> {selectedAppointment.customerPhone}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex gap-2 justify-end mb-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                    ${selectedAppointment.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      selectedAppointment.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        selectedAppointment.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-red-50 text-red-600 border-red-100'}`}>
                    {selectedAppointment.status}
                  </span>
                  {selectedAppointment.source && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-purple-50 text-purple-600 border-purple-100">
                      {selectedAppointment.source.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">
                  Booked: {new Date(selectedAppointment.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all duration-300">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Appointment Date</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                    <FiCalendar size={14} />
                  </div>
                  {selectedAppointment.appointmentDate}
                </p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl group hover:border-amber-200 transition-all duration-300">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Appointment Time</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                    <FiClock size={14} />
                  </div>
                  {selectedAppointment.appointmentTime}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Clinic Location</p>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 text-slate-500 rounded-xl">
                  <FiSettings size={16} />
                </div>
                <p className="text-sm font-bold text-slate-700">{selectedAppointment.clinicName || "Zepofy Medical Center"}</p>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes / Symptoms</p>
              <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                {selectedAppointment.notes || "No additional notes provided by the patient."}
              </p>
            </div>

            {/* 🔥 NEW: Flow Captured Data (MetaData) */}
            {selectedAppointment.metaData && Object.keys(selectedAppointment.metaData).length > 0 && (
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Flow Interaction Data</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedAppointment.metaData)
                    .filter(([key]) => !['userId', 'contactId', 'id', '_id', '__v', 'status', 'appointment_date', 'appointment_time', 'patient_name', 'clinic_name', 'Date', 'Time', 'Symptoms', 'notes'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-0.5">{key.replace(/_/g, ' ')}</p>
                        <p className="text-xs font-bold text-slate-700 truncate" title={String(value)}>{String(value)}</p>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiBell className="text-blue-600" />
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Automation Logs</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${selectedAppointment.remindersEnabled !== false ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {selectedAppointment.remindersEnabled !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center gap-3 shadow-sm shadow-blue-50/50 hover:shadow-md transition-shadow cursor-default">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedAppointment.confirmationReminderSent ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
                    <FiCheckCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Confirmation</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${selectedAppointment.confirmationReminderSent ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {selectedAppointment.confirmationReminderSent ? 'SENT' : 'PENDING'}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center gap-3 shadow-sm shadow-blue-50/50 hover:shadow-md transition-shadow cursor-default">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedAppointment.dayOfReminderSent || selectedAppointment.reminderSent ? 'bg-blue-100 text-blue-600' : 'bg-amber-50 text-amber-500'}`}>
                    <FiClock size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Reminder</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${selectedAppointment.dayOfReminderSent || selectedAppointment.reminderSent ? 'text-blue-600' : 'text-amber-500'}`}>
                      {selectedAppointment.dayOfReminderSent || selectedAppointment.reminderSent ? 'SENT' : 'SCHEDULED'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                Close
              </button>
              {selectedAppointment.status === 'scheduled' && (
                <button
                  onClick={() => {
                    updateStatus(selectedAppointment._id, 'completed');
                    setIsDetailModalOpen(false);
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
