import React, { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";
import { toast } from "react-hot-toast";
import api from "../../api/api";

import SocialSidebar from "./SocialSidebar";
import SocialChat from "./SocialChat";
import SocialDetails from "./SocialDetails";

export default function SocialInbox() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  // Fetch Conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get("/customer-chats/conversations");
      setConversations(res.data.conversations || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Failed to load conversations");
    }
  }, []);

  // Fetch Messages for active conversation
  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const res = await api.get(`/customer-chats/conversations/${conversationId}/messages`);
      if (res.data.success) {
        setMessages(res.data.messages || []);

        // Update local unread count
        setConversations((prev) =>
          prev.map((c) =>
            c._id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv._id);
    }
  }, [activeConv, fetchMessages]);

  // Socket IO Connection
  useEffect(() => {
    // Assuming backend runs on same domain or from env
    const socketInstance = io(import.meta.env.VITE_SERVER_URL || "http://localhost:5000", {
      transports: ["websocket"]
    });

    const userObj = JSON.parse(localStorage.getItem("user") || "{}");
    if (userObj && userObj._id) {
      socketInstance.emit("join_workspace", userObj._id);
    }

    socketInstance.on("social:new_message", (data) => {
      const { conversation, message } = data;

      // Update conversations list
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conversation._id);
        if (exists) {
          // Bring to top and update last message
          const filtered = prev.filter((c) => c._id !== conversation._id);
          return [conversation, ...filtered];
        } else {
          return [conversation, ...prev];
        }
      });

      // Update active messages if it's the current conversation
      if (activeConv && activeConv._id === conversation._id) {
        setMessages((prev) => [...prev, message]);
        // Also clear unread locally since we are looking at it
        if (message.direction === "incoming") {
          api.get(`/customer-chats/conversations/${conversation._id}/messages`).catch(console.error);
        }
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [activeConv]);

  const handleSendMessage = async (text) => {
    if (!activeConv) return;

    // Optimistic UI update
    const tempMsg = {
      direction: "outgoing",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await api.post("/customer-chats/send-message", {
        platform: activeConv.platform,
        recipientId: activeConv.senderId,
        text,
        conversationId: activeConv._id
      });

      if (!res.data.success) {
        throw new Error(res.data.error || "Failed to send");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message: " + (error.response?.data?.error || error.message));
      // Revert optimistic update (ideally)
      setMessages((prev) => prev.filter(m => m !== tempMsg));
    }
  };

  return (
    <>
      <style>{`
        .messages-page-font { font-family: 'Poppins', sans-serif; }
        .heading-font { font-family: 'Poppins', sans-serif; }
        .whatsapp-chat-bg {
          position: absolute; inset: 0; background-color: #f8fafc;
          background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
          background-size: 24px 24px; opacity: 0.5; z-index: 0; pointer-events: none;
        }
        .message-bubble {
          position: relative; max-width: 80%; padding: 10px 16px; border-radius: 16px;
          font-size: 14.5px; line-height: 1.5; z-index: 10;
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.05); word-break: break-word; transition: transform 0.2s ease;
        }
        .message-outgoing {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff;
          border-bottom-right-radius: 4px; align-self: flex-end; margin-right: 4px;
        }
        .message-incoming {
          background-color: #ffffff; color: #1e293b; border: 1px solid #f1f5f9;
          border-bottom-left-radius: 4px; align-self: flex-start; margin-left: 4px;
          box-shadow: 0 4px 12px -4px rgba(0,0,0,0.05);
        }
        .message-time {
          display: flex; align-items: center; justify-content: flex-end; gap: 4px;
          font-size: 11px; margin-top: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ced3d6; border-radius: 10px; }
        .contact-item { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: relative; }
        .contact-item::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #4f46e5; transition: width 0.2s ease; }
        .contact-item.active { background-color: #eef2ff !important; }
        .contact-item.active::before { width: 4px; }
        .contact-item:hover:not(.active) { background-color: #f8fafc; }
      `}</style>
      <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-73px)] w-full bg-[#f0f2f5] messages-page-font overflow-hidden">
        <SocialSidebar
          conversations={conversations}
          activeConvId={activeConv?._id}
          onSelect={setActiveConv}
        />
        <SocialChat
          activeConv={activeConv}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
        <SocialDetails
          activeConv={activeConv}
        />
      </div>
    </>
  );
}
