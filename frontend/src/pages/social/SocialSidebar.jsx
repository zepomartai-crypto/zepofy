import React, { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { FaInstagram, FaFacebookMessenger } from "react-icons/fa";

dayjs.extend(relativeTime);

export default function SocialSidebar({ conversations, activeConvId, onSelect }) {
  const [activeTab, setActiveTab] = useState("dm");

  const filteredConversations = conversations.filter(c => {
    if (activeTab === "dm") return c.conversationType !== "comment";
    if (activeTab === "comment") return c.conversationType === "comment";
    return true;
  });

  return (
    <div className="w-1/3 md:w-80 lg:w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 z-[10] relative shadow-sm transition-all duration-300">
      <div className="h-[58px] px-5 flex items-center justify-between bg-white shrink-0 border-b border-slate-100">
        <h1 className="text-xl font-bold text-[#111b21] heading-font tracking-tight">Social Inbox</h1>
        <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mt-0.5">Meta</p>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 shrink-0 border-b border-slate-50 bg-white shadow-sm z-[5]">
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab("dm")}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              activeTab === "dm" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab("comment")}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              activeTab === "comment" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Comments
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No {activeTab === "comment" ? "comments" : "conversations"} found.</p>
            <p className="text-sm text-slate-400 mt-1">When customers interact, they'll appear here.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredConversations.map((conv) => {
              const isActive = activeConvId === conv._id;
              return (
                <div
                  key={conv._id}
                  onClick={() => onSelect(conv)}
                  className={`contact-item flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-50 relative transition-all ${
                    isActive ? "active" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
                    {conv.customerProfilePic ? (
                      <img
                        src={conv.customerProfilePic}
                        alt={conv.customerName || "User"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-500">
                        {(conv.customerName || conv.customerUsername || "U")[0].toUpperCase()}
                      </div>
                    )}
                    </div>
                    
                    {/* Platform Icon Badge */}
                    <div className="absolute -bottom-1 -right-1 rounded-full p-[2px] border border-white bg-white shadow-sm z-10">
                      {conv.platform === "instagram" ? (
                        <div className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 rounded-full p-[3px] text-white">
                          <FaInstagram className="w-2.5 h-2.5" />
                        </div>
                      ) : (
                        <div className="bg-[#0084ff] rounded-full p-[3px] text-white">
                          <FaFacebookMessenger className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="flex flex-col min-w-0 pr-2">
                        <h3 className={`text-[15px] font-medium truncate ${isActive ? "text-indigo-900 font-bold" : "text-slate-900"}`}>
                          {(!conv.customerName || conv.customerName === "Unknown User") ? conv.customerId : (conv.customerName || conv.customerUsername)}
                        </h3>
                      </div>
                      <span className={`text-[11px] whitespace-nowrap shrink-0 ${conv.unreadCount > 0 ? "text-indigo-600 font-bold" : "text-slate-500"}`}>
                        {conv.updatedAt ? dayjs(conv.updatedAt).fromNow(true) : ""}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-[13px] font-[400] truncate mt-[1px] ${
                        isActive ? "text-indigo-700" : "text-slate-500"
                      }`}>
                        {conv.lastMessage || (conv.conversationType === "comment" ? "New comment" : "Media message")}
                      </p>
                      
                      {conv.unreadCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-semibold h-5 min-w-[20px] flex items-center justify-center px-1.5 rounded-full shadow-sm shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
