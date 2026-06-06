import React, { useMemo, useState } from "react";
import api from "../api/api";
import {
  Eye,
  Clock,
  Users,
  Pause,
  Play,
  Pencil,
  Trash2,
  X,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import nicePrompt from "../components/UI/NicePrompt";
import DensitySelector from "../components/UI/DensitySelector";
import { useNavigate } from "react-router-dom";

export default function CampaignList({ campaigns, refresh, onEdit }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return Number(localStorage.getItem("campaigns_density")) || 10;
  });

  const campaignsWithIndex = useMemo(() => campaigns.map((c, i) => ({ c, i })), [campaigns]);

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCampaigns = campaigns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(campaigns.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const runNow = async (id) => {
    try {
      await api.post(`/campaigns/${id}/run`);
      refresh(); // reload list
      nicePrompt.success("Campaign Started", "Your broadcast is now in the queue for processing.");
    } catch (err) {
      console.warn("Campaign start API error/timeout, but campaign is likely running:", err);
    }
  };

  const pauseCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      refresh(); // IMPORTANT
      nicePrompt.success("Campaign Paused", "The broadcast has been suspended successfully.");
    } catch (err) {
      nicePrompt.error("Action Failed", "Could not pause the campaign at this time.");
    }
  };

  const resumeCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/resume`);
      refresh(); // IMPORTANT
      nicePrompt.success("Campaign Active", "The broadcast has resumed from where it left off.");
    } catch (err) {
      nicePrompt.error("Action Failed", "Failed to resume campaign.");
    }
  };

  const stopCampaign = async (id) => {
    const confirmed = await nicePrompt.confirm("Stop Broadcast", "Are you sure you want to permanently stop this campaign? This cannot be undone.", "danger");
    if (!confirmed) return;
    try {
      await api.post(`/campaigns/${id}/stop`);
      refresh(); // IMPORTANT
      nicePrompt.success("Stopped", "Campaign has been terminated.");
    } catch (err) {
      nicePrompt.error("Action Failed", "Failed to stop campaign.");
    }
  };


  const resendCampaign = async (id) => {
    const confirmed = await nicePrompt.confirm("Resend Campaign", "This will reset all campaign statistics and allow you to send it again from the beginning. Continue?", "info");
    if (!confirmed) return;
    try {
      await api.post(`/campaigns/${id}/resend`);
      refresh();
      nicePrompt.success("Campaign Reset", "Statistics cleared. You can now RUN this campaign again.");
    } catch (err) {
      nicePrompt.error("Action Failed", "Failed to reset campaign for resending.");
    }
  };

  const del = async (id) => {
    const confirmed = await nicePrompt.confirm("Delete Record", "Remove this campaign record from your history?", "danger");
    if (!confirmed) return;
    try {
      await api.delete(`/campaigns/${id}`);
      refresh();
      nicePrompt.success("Removed", "Campaign history deleted.");
    } catch (err) {
      console.error(err);
      nicePrompt.error("Action Refused", "Failed to delete campaign.");
    }
  };

  const statusBadge = (status) => {
    const map = {
      draft: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", label: "Draft" },
      scheduled: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", label: "Scheduled" },
      running: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", label: "Running" },
      paused: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", label: "Paused" },
      completed: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", label: "Completed" },
      failed: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "Failed" },
    };

    const config = map[status] || map.draft;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-widest font-poppins border ${config.bg} ${config.text} ${config.border}`}>
        {status === "running" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
        {status === "completed" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
        {config.label}
      </span>
    );
  };

  const getProgressPercentage = (campaign) => {
    if (campaign.status === "completed") return 100;
    if (!campaign.total || campaign.total === 0) return 0;
    const sent = Number(campaign.sentCount || 0);
    return Math.round((sent / campaign.total) * 100);
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const stats = (campaign) => {
    const sent = Number(campaign.sentCount || 0);
    const delivered = Number(campaign.deliveredCount || 0);
    const read = Number(campaign.readCount || 0);
    const failed = Number(campaign.failedCount || 0);
    const replies = Number(campaign.replyCount || 0);
    return { sent, delivered, read, failed, replies };
  };

  const openCampaignDetails = (campaign) => {
    navigate(`/campaigns/whatsapp/${campaign._id}`);
  };

  if (!campaigns.length) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-xl">📢</span>
        </div>
        <h3 className="text-base font-medium text-gray-900 mb-1">No campaigns yet</h3>
        <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
          Create your first WhatsApp campaign to start engaging with your audience
        </p>
        <div className="text-xs text-gray-500">
          Click "Create Campaign" to get started
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Density Selection Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-end bg-slate-50/30 shrink-0">
        <div className="flex items-center gap-4">
          <DensitySelector
            value={itemsPerPage}
            onChange={(val) => {
              setItemsPerPage(val);
              localStorage.setItem("campaigns_density", val);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[#f8fafc]/50 text-slate-500 font-bold sticky top-0 uppercase tracking-widest z-10 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 border-b border-slate-100 font-poppins text-[10px]">CAMPAIGN INFO</th>
              <th className="px-6 py-4 border-b border-slate-100 font-poppins text-[10px]">STATISTICS</th>
              <th className="px-6 py-4 border-b border-slate-100 font-poppins text-[10px] text-center">STATUS</th>
              <th className="px-6 py-4 border-b border-slate-100 font-poppins text-[10px] text-right">OPERATIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {currentCampaigns.map((c, i) => {
              const { sent, delivered, read, failed, replies } = stats(c);
              const p = getProgressPercentage(c);

              return (
                <tr key={c._id} onClick={() => openCampaignDetails(c)} className="cursor-pointer group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 font-poppins">{c.name}</span>
                      {c.scheduledAt && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 self-start px-2 py-0.5 rounded uppercase tracking-wider font-poppins border border-amber-100">
                          <Clock className="w-3 h-3" />
                          {new Date(c.scheduledAt).toLocaleDateString()} at {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-3 font-medium text-slate-400 text-[11px] uppercase tracking-wider font-poppins">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          <Users className="w-3 h-3" />
                          {c.total || 0}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-300" />
                          {formatDate(c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      <span className="inline-flex items-center justify-center h-6 leading-none text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 rounded-md uppercase tracking-widest border border-blue-200">SENT {sent}</span>
                      <span className="inline-flex items-center justify-center h-6 leading-none text-[10px] font-bold bg-sky-50 text-sky-600 px-2.5 rounded-md uppercase tracking-widest border border-sky-200">DLVR {delivered}</span>
                      <span className="inline-flex items-center justify-center h-6 leading-none text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 rounded-md uppercase tracking-widest border border-indigo-200">READ {read}</span>
                      <span className="inline-flex items-center justify-center h-6 leading-none text-[10px] font-bold bg-amber-50 text-amber-600 px-2.5 rounded-md uppercase tracking-widest border border-amber-200">REPLY {replies}</span>
                      <span className="inline-flex items-center justify-center h-6 leading-none text-[10px] font-bold bg-red-50 text-red-600 px-2.5 rounded-md uppercase tracking-widest border border-red-200">FAIL {failed}</span>
                    </div>
                    <div className="flex items-center gap-3 w-full max-w-[220px]">
                      <div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${c.status === "completed"
                            ? "bg-emerald-500"
                            : c.status === "running"
                              ? "bg-blue-500"
                              : c.status === "paused"
                                ? "bg-amber-500"
                                : c.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-slate-400"
                            }`}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 w-8">{p}%</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    {statusBadge(c.status)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>

                      <button
                        onClick={() => {
                          if (c.status === "paused") {
                            resumeCampaign(c._id);
                          } else {
                            runNow(c._id);
                          }
                        }}
                        disabled={!(
                          c.status === "draft" ||
                          c.status === "paused"
                        )}

                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest font-poppins transition-all
                          ${c.status === "draft" || c.status === "paused"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                            : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          }

                        `}
                      >
                        <Play className="w-3 h-3" />
                        {c.status === "paused" ? "RES" : "RUN"}
                      </button>

                      <button
                        onClick={() => pauseCampaign(c._id)}
                        disabled={c.status !== "running"}
                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest font-poppins transition-all
                          ${c.status === "running"
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white"
                            : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          }
                        `}
                      >
                        <Pause className="w-3 h-3" />
                        PAUSE
                      </button>

                      <button
                        onClick={() => stopCampaign(c._id)}
                        disabled={!(c.status === "running" || c.status === "paused")}
                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest font-poppins transition-all
                          ${(c.status === "running" || c.status === "paused")
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white"
                            : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          }
                        `}
                      >
                        <X className="w-3 h-3" />
                        STOP
                      </button>

                      {(c.status === "completed" || c.status === "failed") && (
                        <button
                          onClick={() => resendCampaign(c._id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold uppercase tracking-widest font-poppins transition-all shadow-sm active:scale-95"
                          title="Reset & Resend"
                        >
                          <RefreshCcw className="w-3 h-3" />
                          RESEND
                        </button>
                      )}

                      <div className="w-px h-5 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => openCampaignDetails(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => del(c._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-white shrink-0">
        <div className="text-[12px] font-medium text-slate-500 font-poppins">
          Showing <span className="font-bold text-slate-800">{campaigns.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, campaigns.length)}</span> of <span className="font-bold text-slate-800">{campaigns.length}</span> campaigns
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className={`h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1 transition-all ${
              currentPage === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 active:scale-95'
            }`}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages || 1)].map((_, i) => {
              const pageNum = i + 1;
              if ((totalPages || 1) > 7 && pageNum > 1 && pageNum < (totalPages || 1) && Math.abs(pageNum - currentPage) > 1) {
                if (pageNum === 2 || pageNum === (totalPages || 1) - 1) return <span key={pageNum} className="text-slate-300 text-xs px-1">...</span>;
                return null;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => paginate(pageNum)}
                  className={`w-8 h-8 rounded-full text-[12px] font-bold flex items-center justify-center transition-all ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage === (totalPages || 1) || (totalPages || 1) === 0}
            className={`h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1 transition-all ${
              currentPage === (totalPages || 1) || (totalPages || 1) === 0
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 active:scale-95'
            }`}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
