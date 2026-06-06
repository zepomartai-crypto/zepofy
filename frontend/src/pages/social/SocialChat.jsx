import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import { FaPaperPlane, FaInstagram, FaFacebookMessenger } from "react-icons/fa";

export default function SocialChat({ activeConv, messages, onSendMessage }) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!activeConv) {
    return (
      <div className="flex-1 bg-[#f8fafc] flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700">Your Messages</h3>
        <p className="text-gray-500 mt-2">Select a conversation to start chatting.</p>
      </div>
    );
  }

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <div className="flex-1 flex flex-col relative bg-transparent overflow-hidden">
      {/* Background Pattern */}
      <div className="whatsapp-chat-bg"></div>

      {/* Header */}
      <div className="h-[58px] px-4 flex items-center bg-[#f0f2f5] border-b border-[#d1d7db] z-[50] shrink-0 justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 border border-slate-100 transition-all group-hover:border-indigo-200 relative">
              {activeConv.customerProfilePic ? (
                <img src={activeConv.customerProfilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-500">
                  {(activeConv.customerName || activeConv.customerUsername || "U")[0].toUpperCase()}
                </div>
              )}

              {/* Platform Icon Badge in Header */}
              <div className="absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white bg-white shadow-sm">
                {activeConv.platform === "instagram" ? (
                  <div className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 rounded-full p-0.5 text-white">
                    <FaInstagram className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="bg-[#0084ff] rounded-full p-0.5 text-white">
                    <FaFacebookMessenger className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold font-poppins text-slate-900 leading-tight truncate">
              {activeConv.customerName || activeConv.customerUsername || activeConv.customerId}
            </h2>
            <span className="text-[12px] font-bold font-poppins text-slate-500/80 tracking-tight mt-0.5 flex items-center gap-1">
              {activeConv.platform === 'instagram' ? 'Instagram' : 'Facebook Messenger'}
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block ml-1"></span>
            </span>
          </div>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-10 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-sm">
              <div className="w-12 h-12 bg-blue-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="text-gray-900 font-semibold mb-1">Start the conversation</h4>
              <p className="text-sm text-gray-500">Send a message to {activeConv.customerName || "this user"} to start chatting.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOutgoing = msg.direction === "outgoing" || msg.senderType === "agent";
            const displayText = msg.text || msg.messageText || "";

            return (
              <div key={idx} className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
                <div className={`message-bubble ${isOutgoing ? "message-outgoing" : "message-incoming"}`}>
                  <p>{displayText}</p>
                  <div className="message-time">
                    {dayjs(msg.timestamp).format("h:mm A")}
                    {isOutgoing && (
                      <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 bg-[#f0f2f5] z-30 flex items-end gap-2 border-t border-[#d1d7db]">
        <form onSubmit={handleSend} className="flex-1 flex items-end bg-white rounded-[24px] shadow-sm relative pl-2 pr-2 overflow-hidden border border-slate-200">
          <input
            type="text"
            className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-slate-700 placeholder-slate-400 text-[15px] max-h-32 font-poppins min-h-[44px]"
            placeholder={`Message ${activeConv.customerName || "User"}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="flex items-center pb-2">
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-10 h-10 flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all disabled:opacity-50 disabled:bg-indigo-400 shrink-0 shadow-md transform hover:scale-105 active:scale-95"
            >
              <FaPaperPlane className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
