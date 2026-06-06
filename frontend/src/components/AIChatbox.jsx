import { useState, useEffect, useRef } from 'react';
import {
  FiMessageSquare, FiX, FiMinus, FiSend,
  FiUser, FiChevronLeft,
  FiChevronRight, FiThumbsUp, FiThumbsDown, FiInfo, FiSmile,
  FiHome, FiMail, FiPaperclip, FiMic, FiImage
} from 'react-icons/fi';
import { IoMdPaperPlane } from "react-icons/io";
import api from '../api/api';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/useAuth';

const AIChatbox = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'chat'
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData) => {
    setInput(prev => prev + emojiData.emoji);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isTyping, activeTab]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/ai-chat/history');
      if (res.data.success && res.data.history.length > 0) {
        const formatted = res.data.history.flatMap(chat => [
          { text: chat.message, sender: 'user', timestamp: chat.createdAt },
          { text: chat.response, sender: 'ai', timestamp: chat.createdAt, chatId: chat._id, rating: chat.rating }
        ]);
        setMessages(formatted);
      }
    } catch (error) {
      console.error("Failed to load AI chat history:", error);
    }
  };

  const helpArticles = [
    "How to create WhatsApp Template Messages?",
    "How to apply for WhatsApp Business API?",
    "Setting up WooCommerce Webhook",
    "Importing Contacts from CSV"
  ];

  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = { text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setActiveTab('chat');
    setIsTyping(true);

    try {
      const res = await api.post('/ai-chat/ask', { message: text });

      setTimeout(() => {
        const aiMessage = {
          text: res.data.answer,
          sender: 'ai',
          timestamp: new Date(),
          chatId: res.data.chatId,
          source: res.data.source
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
      }, 1000);

    } catch (error) {
      console.error("AI Chat Error:", error);
      setIsTyping(false);
      toast.error("Failed to get response from AI");
    }
  };

  const handleRate = async (index, rating) => {
    const msg = messages[index];
    if (!msg.chatId) return;

    try {
      await api.post('/ai-chat/rate', { chatId: msg.chatId, rating });
      const newMessages = [...messages];
      newMessages[index].rating = rating;
      setMessages(newMessages);
      toast.success("Thank you for your feedback!");
    } catch (error) {
      toast.error("Failed to submit rating");
    }
  };

  const lastAiMessage = [...messages].reverse().find(m => m.sender === 'ai');

  const [isVisible, setIsVisible] = useState(true);

  if (!isOpen) {
    if (!isVisible) return null;
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
        <button
          onClick={() => setIsVisible(false)}
          className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 shadow-sm transition-all focus:outline-none"
          title="Remove floating chatbox"
        >
          <FiX size={14} />
        </button>
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[14px] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95 group border border-blue-500/50"
        >
          <FiMessageSquare size={22} className="group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-[2px] border-white shadow-sm"></span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed right-6 bottom-6 z-50 transition-all duration-300 ease-in-out transform ${isMinimized ? 'h-16 w-80' : 'h-[640px] w-[380px]'
        }`}
    >
      <div className="bg-white h-full w-full rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-col font-[Poppins]">

        {/* Header - Compact when minimized */}
        <div className={`bg-white text-slate-900 border-b border-slate-100 flex items-center justify-between px-6 py-4 ${isMinimized ? 'h-16' : ''}`}>
          <div className="flex items-center gap-3">
            {activeTab === 'chat' && !isMinimized && (
              <button onClick={() => setActiveTab('home')} className="p-2 hover:bg-slate-50 rounded-full transition-colors border border-slate-100">
                <FiChevronLeft size={18} className="text-slate-600" />
              </button>
            )}
            {activeTab === 'chat' && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="https://ui-avatars.com/api/?name=Zepofy+AI&background=3B82F6&color=fff"
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                    alt="AI"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="font-bold text-[14px] text-slate-900 leading-tight">Zepofy AI</h3>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Online</p>
                </div>
              </div>
            )}
            {activeTab === 'home' && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <FiMessageSquare size={16} />
                </div>
                <h3 className="font-bold text-[15px] text-slate-900">Support Center</h3>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 border border-transparent hover:border-slate-100 transition-all">
              <FiMinus size={18} />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 border border-transparent hover:border-slate-100 transition-all">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex-1 flex flex-col bg-white relative overflow-hidden">

            {/* HOME VIEW */}
            {activeTab === 'home' && (
              <div className="flex-1 flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-white via-slate-50/30 to-slate-50/50">
                {/* User Info Header */}
                <div className="space-y-4 pt-2">
                  <div className="flex -space-x-3">
                    <img src="https://i.pravatar.cc/100?u=1" className="w-10 h-10 rounded-full border-4 border-white shadow-sm" alt="Team" />
                    <img src="https://i.pravatar.cc/100?u=2" className="w-10 h-10 rounded-full border-4 border-white shadow-sm" alt="Team" />
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-[12px] flex items-center justify-center font-bold border-4 border-white shadow-md">Z</div>
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">Hi {user?.name?.split(' ')[0] || 'there'} 👋</h2>
                    <h3 className="text-[16px] font-semibold text-slate-500 leading-snug">How can we help you today?</h3>
                  </div>
                </div>

                {/* Recent Message Card */}
                {lastAiMessage && (
                  <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer group" onClick={() => setActiveTab('chat')}>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-4 opacity-60">Continue Reading</p>
                    <div className="flex gap-4">
                      <div className="shrink-0 w-12 h-12 rounded-[16px] bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        <FiMessageSquare size={22} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-[14px] text-slate-900">Previous Chat</p>
                        <p className="text-[12px] font-semibold text-slate-500 truncate mt-1">{lastAiMessage.text}</p>
                        <span className="text-[10px] font-bold text-slate-400 mt-3 block uppercase tracking-wider">AI AGENT • 1m ago</span>
                      </div>
                      <FiChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform self-center" />
                    </div>
                  </div>
                )}

                {/* Ask Question Card */}
                <div className="bg-blue-600 p-6 rounded-[24px] shadow-xl shadow-blue-500/10 hover:bg-blue-700 transition-all cursor-pointer group" onClick={() => setActiveTab('chat')}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-bold text-[15px] text-white">Ask a question</p>
                      <p className="text-[12px] font-semibold text-blue-100/80">Get instant AI support</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform">
                      <FiSend size={22} className="text-white" />
                    </div>
                  </div>
                </div>

                {/* Help Search Section */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between mb-5">
                    <p className="font-bold text-[14px] text-slate-900">Knowledge Base</p>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Explore All</div>
                  </div>
                  <div className="space-y-5">
                    {helpArticles.map((article, idx) => (
                      <div key={idx} className="flex items-center justify-between group cursor-pointer" onClick={() => handleSend(article)}>
                        <p className="text-[12px] font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">{article}</p>
                        <FiChevronRight size={14} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CHAT VIEW */}
            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
                  <div className="text-center py-2">
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-4 py-1.5 rounded-full border border-slate-100 uppercase tracking-[0.2em] shadow-sm">Chat History</span>
                  </div>

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                      <div className={`max-w-[88%]`}>
                        <div className={`p-4 rounded-[20px] text-[13px] shadow-sm leading-relaxed ${msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none prose prose-sm prose-slate max-w-none font-semibold'
                          }`}>
                          {msg.sender === 'ai' ? (
                            <ReactMarkdown
                              components={{
                                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-2 my-2" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-2 my-2" {...props} />,
                                li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                strong: ({ node, ...props }) => <strong className="font-bold text-slate-900 underline underline-offset-2 decoration-blue-200" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          ) : (
                            msg.text
                          )}
                        </div>
                        <div className={`flex items-center gap-2 mt-2 px-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.sender === 'ai' && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                disabled={!!msg.rating}
                                onClick={() => handleRate(idx, 'up')}
                                className={`transition-all p-1 rounded hover:bg-white shadow-sm border border-transparent hover:border-slate-100 ${msg.rating === 'up' ? 'text-blue-500 bg-white' : 'text-slate-300 hover:text-blue-500'}`}
                              >
                                <FiThumbsUp size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                      <div className="bg-white border border-slate-200 p-4 rounded-[20px] rounded-tl-none shadow-sm flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <FiMessageSquare size={14} />
                          </div>
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-slate-100 relative shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-[100%] left-6 z-[100] mb-4 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={330}
                        height={380}
                        previewConfig={{ showPreview: false }}
                        skinTonesDisabled
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex-1 bg-slate-50/50 rounded-[20px] p-1 border border-slate-200 focus-within:border-blue-500/30 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-blue-500/5 transition-all">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Type your message..."
                        className="w-full py-3 px-4 bg-transparent text-[13px] border-none focus:ring-0 resize-none outline-none custom-scrollbar max-h-32 font-semibold text-slate-700 placeholder:text-slate-400"
                        rows="1"
                      />
                      <div className="flex items-center justify-between p-2 pt-0">
                        <div className="flex items-center gap-1 pl-2">
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-2 transition-all rounded-xl ${showEmojiPicker ? 'text-blue-500 bg-blue-50' : 'text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm hover:border-slate-100'}`}
                          >
                            <FiSmile size={20} />
                          </button>
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={!input.trim()}
                          className={`w-11 h-11 rounded-[14px] flex items-center justify-center transition-all ${input.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                        >
                          <IoMdPaperPlane size={22} className={input.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* BOTTOM TABS */}
            {!isMinimized && (
              <div className="bg-white border-t border-slate-100 flex items-center justify-around p-4 pb-6">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all ${activeTab === 'home' ? 'bg-blue-50 shadow-sm border border-blue-100' : 'bg-transparent'}`}>
                    <FiHome size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] leading-none">Home</span>
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'chat' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all ${activeTab === 'chat' ? 'bg-blue-50 shadow-sm border border-blue-100' : 'bg-transparent'}`}>
                    <FiMail size={20} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] leading-none">Chat</span>
                </button>
              </div>
            )}

            <div className="bg-slate-50/50 py-3 flex items-center justify-center gap-2 border-t border-slate-100">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">Powered by Zepofy AI</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChatbox;
