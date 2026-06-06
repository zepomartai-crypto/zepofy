import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { FiSend, FiSearch, FiTag, FiUsers, FiFileText, FiPlus, FiCheckCircle, FiCheck, FiClock, FiAlertCircle, FiChevronRight, FiChevronLeft, FiChevronDown, FiPaperclip, FiImage, FiSmile, FiMic, FiDownload, FiTrash2, FiLock, FiInfo, FiX, FiUpload, FiLink, FiPhone, FiShoppingBag, FiExternalLink, FiFilter, FiSettings, FiCalendar, FiUser, FiActivity, FiBriefcase, FiMessageSquare, FiLayers } from "react-icons/fi";
import EmojiPicker from 'emoji-picker-react';
import TemplateMessageBubble from "../components/Templates/TemplateMessageBubble";
import { processTemplateVariables, buildFinalParameters, generatePreview } from "../utils/simpleVariableHandler";
import { getImageUrl } from "../utils/imageHelpers";
import { uploadFile } from "../utils/uploadService";

// Helper function to get full image URL
// Image URL helper is now imported from utils/imageHelpers


export default function Messages() {
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [campaignList, setCampaignList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");
  const [sendMode, setSendMode] = useState("text");
  const [text, setText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateParams, setTemplateParams] = useState({});
  const [processedTemplate, setProcessedTemplate] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", tags: [], groupId: "", newGroupName: "" });
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [globalTags, setGlobalTags] = useState([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showAssignGroup, setShowAssignGroup] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showContactInfo, setShowContactInfo] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [skipExtraLines, setSkipExtraLines] = useState(false);
  const [mergeRemaining, setMergeRemaining] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState("All Categories");
  const [localTemplateSessions, setLocalTemplateSessions] = useState({}); // Stores { customerId: timestamp }
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    replyStatus: 'all',
    unread: 'all',
    campaignId: '',
    campaignReply: '',
    assignedTo: '',
    flowStatus: '',
    messageType: '',
    contactType: '',
    tags: []
  });
  const [totalContacts, setTotalContacts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);

  // 🔥 NEW: Flow Sending States
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [publishedFlows, setPublishedFlows] = useState([]);
  const [sendingFlowId, setSendingFlowId] = useState(null);

  // 🔥 HEADER OVERRIDE STATES
  const [headerOverrideUrl, setHeaderOverrideUrl] = useState("");
  const [headerOverrideTab, setHeaderOverrideTab] = useState("url"); // 'url' or 'upload'
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState([]); // For Catalog mapping
  const [selectedProductSku, setSelectedProductSku] = useState(""); // Selected thumbnail SKU

  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mobileView, setMobileView] = useState("list"); // 'list' or 'chat'
  const [tick, setTick] = useState(0); // 🔥 NEW: Force re-render for time-based status
  const location = useLocation();

  const [previewImage, setPreviewImage] = useState(null);
  const [imageCaption, setImageCaption] = useState("");

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage({
          file: file,
          previewUrl: event.target.result
        });
        setShowAttachmentMenu(false);
      };
      reader.readAsDataURL(file);
    }
    // reset input
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const uploadAndSendImage = async () => {
    if (!previewImage || !activeCustomer) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("image", previewImage.file);

    try {
      // 1. Upload to server
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const mediaUrl = uploadRes.data.url;

      // 2. Send via WhatsApp / inbox/send-media
      const payload = {
        mediaUrl,
        mediaType: "image",
        filename: previewImage.file.name,
        caption: imageCaption.trim() ? imageCaption : undefined,
        customerId: activeCustomer.isGroup ? null : activeCustomer._id,
        groupId: activeCustomer.isGroup ? activeCustomer._id : null
      };

      const res = await api.post("/inbox/send-media", payload);

      if (res.data.success && res.data.msg) {
        setMessages((prev) => [...prev, res.data.msg]);
        if (typeof fetchCustomers === 'function') fetchCustomers();
        setPreviewImage(null);
        setImageCaption("");
      }
    } catch (err) {
      console.error("Image upload failed", err);
      // fallback alert for UX
      alert("Failed to send image. Please try again.");
    } finally {
      setIsUploading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  useEffect(() => {
    const fetchGlobalTags = async () => {
      try {
        const res = await api.get("/tags");
        if (res.data.success) {
          setGlobalTags(res.data.tags || []);
        }
      } catch (err) {
        console.error("Failed to load global tags", err);
      }
    };
    fetchGlobalTags();
  }, []);

  useEffect(() => {
    const fetchGroupsData = async () => {
      try {
        const res = await api.get("/contact-groups");
        if (res.data.success) setGroups(res.data.groups || []);
      } catch (err) {
        console.error("Failed to fetch groups:", err);
      }
    };

    const fetchCampaignsData = async () => {
      try {
        const timestamp = Date.now();
        const res = await api.get(`/campaigns?t=${timestamp}`);
        if (res.data.success) {
          const fetchedCampaigns = res.data.campaigns || [];
          setCampaignList(fetchedCampaigns);
          console.log(`✅ Loaded ${fetchedCampaigns.length} campaigns for filtering`);
        } else {
          console.warn("⚠️ Campaigns fetch success=false:", res.data);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns for filter:", err);
      }
    };

    fetchGroupsData();
    fetchCampaignsData();
  }, []);

  // 🔥 NEW: Ticker to keep "Online/Offline" status accurate (every 1 minute)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ✅ AUTO-SELECT CUSTOMER FROM URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const phone = params.get('phone');
    const contactId = params.get('id');
    const name = params.get('name');

    if (!phone && !contactId) return;

    // Wait until initial loading is done to avoid conflicts
    if (loading) return;

    const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

    // Check if already active to avoid loops
    if (activeCustomer) {
      const activePhone = (activeCustomer.phone || '').replace(/\D/g, '');
      if (contactId && activeCustomer._id === contactId) return;
      if (cleanPhone && (activePhone.endsWith(cleanPhone) || cleanPhone.endsWith(activePhone))) return;
    }

    const initiateChat = async () => {
      let contact = null;

      // 1. Search local state first
      if (contactId) {
        contact = customers.find(c => c._id === contactId);
      } else if (cleanPhone) {
        contact = customers.find(c => {
          const cPhone = (c.phone || '').replace(/\D/g, '');
          return cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone);
        });
      }

      if (contact) {
        console.log("✅ Auto-selected from local list:", contact.name);
        selectCustomer(contact);
        navigate('/messages', { replace: true });
        return;
      }

      // 2. Not in local list (maybe not in inbox yet), search in contacts DB
      if (contactId || cleanPhone) {
        try {
          console.log("🔍 Contact not in inbox list, searching DB...");
          const searchRes = contactId
            ? await api.get(`/contacts/${contactId}`)
            : await api.get(`/contacts?search=${cleanPhone}`);

          const dbContact = contactId ? searchRes.data.contact : searchRes.data.contacts?.[0];

          if (dbContact) {
            console.log("✅ Found in DB, adding to view:", dbContact.name);
            setCustomers(prev => {
              if (prev.some(c => c._id === dbContact._id)) return prev;
              return [dbContact, ...prev];
            });
            selectCustomer(dbContact);
            navigate('/messages', { replace: true });

            // 🔥 Check if we should prompt for template (if 24h window closed)
            const lastIncoming = dbContact.lastIncomingAt ? new Date(dbContact.lastIncomingAt) : null;
            const is24hPassed = !lastIncoming || (new Date() - lastIncoming) > 24 * 60 * 60 * 1000;

            if (is24hPassed) {
              console.log("⌛ 24h passed, but auto-open template modal is disabled");
            }
          } else if (cleanPhone) {
            // 3. Truly new number - create it to start chat
            console.log("✨ Creating new contact for chat:", cleanPhone);
            const createRes = await api.post("/contacts", {
              name: name || "New Customer",
              phone: cleanPhone
            });
            if (createRes.data.success) {
              const created = createRes.data.contact;
              setCustomers(prev => [created, ...prev]);
              selectCustomer(created);
              navigate('/messages', { replace: true });
            }
          }
        } catch (err) {
          console.error("Failed to auto-initiate chat", err);
        }
      }
    };

    initiateChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.search]);
  const loadMessages = async (id) => {
    console.log("🔍 FRONTEND DEBUG: Loading messages for contact ID:", id);
    try {
      const res = await api.get(`/inbox/messages/${id}`);
      console.log("🔍 FRONTEND DEBUG: API response:", res.data);
      setMessages(res.data || []);

      // Refresh the chat list so unread counts update immediately
      // fetchCustomers(); // Removed to prevent infinite loop and redundant refreshing

      // 🔔 Mark notifications as read for this conversation
      if (res.data && res.data.length > 0) {
        const conversationId = res.data[0].conversationId;
        if (conversationId) {
          try {
            await api.post("/inbox/notifications/mark-read", { conversationId });
            console.log("🔔 Notifications marked as read for conversation:", conversationId);

            // 🔌 Emit socket event to clear notification badge in Navbar
            if (window.zepofySocket && window.zepofySocket.connected) {
              window.zepofySocket.emit('notifications_cleared', { conversationId });
              console.log("🔌 Socket event 'notifications_cleared' emitted");
            }
          } catch (error) {
            console.error("Failed to mark notifications as read:", error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
    }
  };

  const selectCustomer = async (cust) => {
    setActiveCustomer(cust);
    setMessages([]);
    setMobileView("chat"); // Switch to chat mode on mobile
    requestAnimationFrame(() => {
      if (chatContainerRef.current) chatContainerRef.current.scrollTop = 0;
    });

    // 🔥 PERSISTENCE: Save active customer ID
    localStorage.setItem("activeCustomerId", cust._id);

    // 🔥 MARK AS READ (META BLUE TICKS)
    if (cust.unreadCount > 0) {
      try {
        await api.post("/inbox/mark-read", {
          customerId: cust.isGroup ? null : cust._id,
          groupId: cust.isGroup ? cust._id : null
        });
        // Update local state immediately
        if (cust.isGroup) {
          setGroups(prev => prev.map(g => g._id === cust._id ? { ...g, unreadCount: 0 } : g));
        } else {
          setCustomers(prev => prev.map(c => c._id === cust._id ? { ...c, unreadCount: 0 } : c));
        }
      } catch (err) {
        console.error("Failed to mark read:", err);
      }
    }

    await loadMessages(cust._id);
  };

  const handleClearChat = async () => {
    if (!activeCustomer) return;

    const confirmClear = window.confirm(`Are you sure you want to clear all messages for ${activeCustomer.name}? This cannot be undone.`);
    if (!confirmClear) return;

    try {
      const res = await api.delete(`/inbox/clear/${activeCustomer._id}`);
      if (res.data.success) {
        setMessages([]);
        // Update local customer list last message
        setCustomers(prev => prev.map(c =>
          c._id === activeCustomer._id ? { ...c, lastMessage: "", unreadCount: 0 } : c
        ));
        console.log("✅ Chat cleared successfully");
      }
    } catch (err) {
      console.error("❌ Failed to clear chat:", err);
      alert("Failed to clear chat. Please try again.");
    }
  };

  const selectGroup = async (group) => {
    setActiveCustomer({ ...group, isGroup: true });
    setMessages([]);
    setMobileView("chat"); // Switch to chat mode on mobile
    requestAnimationFrame(() => {
      if (chatContainerRef.current) chatContainerRef.current.scrollTop = 0;
    });
    
    await loadMessages(group._id);
  };

  const getLastMessage = (customerId) => {
    // Find the last message for this customer
    const customerMessages = messages.filter(msg =>
      msg.customerId === customerId || msg.recipientId === customerId
    );
    return customerMessages[customerMessages.length - 1];
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ REAL-TIME SOCKET LISTENER
  useEffect(() => {
    const handleNewMessage = (data) => {
      console.log("🔌 SOCKET: New message received in Messages page:", data);

      // 1. If message is for currently active customer/group, append it
      if (activeCustomer) {
        const isForActiveCustomer = !activeCustomer.isGroup && data.customerId?.toString() === activeCustomer._id?.toString();
        const isForActiveGroup = activeCustomer.isGroup && data.groupId?.toString() === activeCustomer._id?.toString();

        if (isForActiveCustomer || isForActiveGroup) {
          console.log("🔌 SOCKET: Appending message to active chat");
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.metaMessageId === data.metaMessageId)) return prev;
            return [...prev, data];
          });

          // Mark as read automatically if we are looking at it
          if (data.direction === 'incoming') {
            setActiveCustomer(prev => ({ ...prev, lastIncomingAt: data.createdAt }));

            // 1. Mark in Meta & Local DB
            api.post("/inbox/mark-read", {
              customerId: data.customerId
            }).catch(err => console.error("Failed to mark auto-read:", err));

            // 2. Mark notifications (legacy/extra layer)
            api.post("/inbox/notifications/mark-read", {
              conversationId: data.conversationId
            }).catch(err => console.error("Failed to mark auto-read-notifications:", err));
          }
        }
      }

      // 2. Optimistic Update for Contact List
      setCustomers(prev => {
        const index = prev.findIndex(c => c._id?.toString() === data.customerId?.toString());

        let updatedCustomers = [...prev];
        let contact;

        if (index !== -1) {
          contact = { ...updatedCustomers[index] };
          updatedCustomers.splice(index, 1);
        } else {
          // If contact not in list, we'll need to fetch eventually, but let's try to create a placeholder
          contact = {
            _id: data.customerId,
            name: data.direction === 'incoming' ? (data.senderName || "New Customer") : "New Customer",
            phone: data.phone,
            unreadCount: 0
          };
        }

        // Update fields with real data from backend socket payload
        contact.lastMessage = data.text || data.body || "Media";
        contact.lastMessageTime = data.createdAt || new Date();
        contact.lastIncomingAt = data.direction === 'incoming' ? data.createdAt : contact.lastIncomingAt;
        contact.lastSender = data.direction === 'incoming' ? 'customer' : 'admin';

        // Use the count from backend if available, otherwise increment
        if (data.unreadCount !== undefined) {
          contact.unreadCount = data.unreadCount;
        } else {
          const isNotActive = activeCustomer?._id?.toString() !== data.customerId?.toString();
          if (data.direction === 'incoming' && isNotActive) {
            contact.unreadCount = (contact.unreadCount || 0) + 1;
          }
        }

        // Always move to top
        return [contact, ...updatedCustomers];
      });

      // 3. Fallback refresh (Debounced or conditional)
      // Only fetch if it's a completely new contact we didn't have before
      // or after a small delay to ensure DB consistency
      if (data.direction === 'incoming') {
        // Optional: fetchCustomers(); 
      }
    };

    const handleMessagesRead = (data) => {
      console.log("🔌 SOCKET: Messages read for customer:", data.customerId);
      setCustomers(prev => prev.map(c =>
        c._id?.toString() === data.customerId?.toString() ? { ...c, unreadCount: 0 } : c
      ));
      if (activeCustomer?._id?.toString() === data.customerId?.toString()) {
        setMessages(prev => prev.map(m => ({ ...m, status: 'read', isRead: true })));
      }
    };

    const handleStatusUpdate = (data) => {
      console.log("🔌 SOCKET: Status update received:", data);
      setMessages(prev => prev.map(m =>
        m.metaMessageId === data.metaMessageId ? { ...m, status: data.status } : m
      ));
    };

    if (window.zepofySocket) {
      window.zepofySocket.on('new_message', handleNewMessage);
      window.zepofySocket.on('message_status', handleStatusUpdate);
      window.zepofySocket.on('messages_read', handleMessagesRead);
    }

    return () => {
      if (window.zepofySocket) {
        window.zepofySocket.off('new_message', handleNewMessage);
        window.zepofySocket.off('message_status', handleStatusUpdate);
        window.zepofySocket.off('messages_read', handleMessagesRead);
      }
    };
  }, [activeCustomer]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      // On larger screens, reset mobile view if needed
      if (window.innerWidth >= 768) {
        setMobileView("list");
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive logic for closing contact info
  useEffect(() => {
    if (windowWidth < 1024) {
      setShowContactInfo(false);
    } else {
      setShowContactInfo(true);
    }
  }, [windowWidth]);

  // Fetch Inventory Products for Catalog Mapping
  const fetchInventoryProducts = async () => {
    try {
      const res = await api.get("/commerce/products/skus");
      if (res.data.success) {
        setInventoryProducts(res.data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch product SKUs", err);
    }
  };

  useEffect(() => {
    if (showTemplateModal) {
      fetchInventoryProducts();
    }
  }, [showTemplateModal]);

  // Process template when selected
  useEffect(() => {
    if (!selectedTemplateId || !activeCustomer) {
      setProcessedTemplate(null);
      setSelectedProductSku(""); // Reset SKU on change
      return;
    }

    setSelectedProductSku(""); // Reset SKU on change

    const selectedTemplate = templates.find(t => t._id === selectedTemplateId);
    if (!selectedTemplate) return;

    const processed = processTemplateVariables(
      selectedTemplate.body,
      activeCustomer,
      currentUser || {}
    );

    setProcessedTemplate(processed);
    console.log('🎯 TEMPLATE PROCESSED:', processed);
  }, [selectedTemplateId, activeCustomer, currentUser]);

  // ✅ Check if customer has received a template before
  const hasCustomerReceivedTemplate = (customerId) => {
    const customerMessages = messages.filter(msg =>
      (msg.customerId === customerId || msg.recipientId === customerId) &&
      msg.type === 'template' &&
      msg.direction === 'outgoing'
    );
    return customerMessages.length > 0;
  };

  // ✅ Check if 24-hour session window is active (Persistent)
  const isSessionActive = () => {
    if (!activeCustomer) return false;
    if (activeCustomer.isGroup) return true; // Groups don't have session restriction

    // 1. WhatsApp Official Session (User Replied)
    const lastIncoming = activeCustomer.lastIncomingAt;
    if (lastIncoming) {
      const last = new Date(lastIncoming).getTime();
      const now = new Date().getTime();
      if ((now - last) <= (24 * 60 * 60 * 1000)) return true;
    }

    // 2. Persistent check in message history (If we sent a template to re-open window)
    // We check the last 50 messages to see if any outgoing template exists within 24h
    const lastOutgoingTemplate = [...messages].reverse().find(msg =>
      (msg.type === 'template' || msg.template) && msg.direction === 'outgoing'
    );

    if (lastOutgoingTemplate) {
      const last = new Date(lastOutgoingTemplate.createdAt).getTime();
      const now = new Date().getTime();
      // If we sent a template in the last 24h, hide the banner/allow text
      if ((now - last) <= (24 * 60 * 60 * 1000)) return true;
    }

    // 3. Fallback to session state (for immediate UI update)
    const templateSentAt = localTemplateSessions[activeCustomer._id];
    if (templateSentAt) {
      const last = new Date(templateSentAt).getTime();
      const now = new Date().getTime();
      if ((now - last) <= (24 * 60 * 60 * 1000)) return true;
    }

    return false;
  };

  // ✅ Check if text messaging is allowed for current customer (based on session or template send)
  const isTextMessagingAllowed = () => {
    if (!activeCustomer) return false;
    if (activeCustomer.isGroup) return true;
    return isSessionActive();
  };

  const handleEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
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

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setShowAttachmentMenu(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload to server
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const mediaUrl = uploadRes.data.url;

      // 2. Send via WhatsApp
      await sendMedia(mediaUrl, type, file.name);

      console.log(`✅ ${type} uploaded and sent successfully`);
    } catch (error) {
      console.error(`❌ Failed to send ${type}:`, error);
      alert(`Failed to send ${type}. Please try again.`);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const sendMedia = async (mediaUrl, mediaType, filename = "") => {
    if (!activeCustomer || isSending) return;
    setIsSending(true);

    const payload = {
      mediaUrl,
      mediaType,
      filename,
      customerId: activeCustomer.isGroup ? null : activeCustomer._id,
      groupId: activeCustomer.isGroup ? activeCustomer._id : null
    };

    try {
      const res = await api.post("/inbox/send-media", payload);

      if (res.data.success && res.data.msg) {
        setMessages((p) => [...p, res.data.msg]);
        fetchCustomers(); // Refresh list to update last message
      }
    } catch (error) {
      console.error("❌ Media send failed:", error);
      const errorData = error.response?.data || {};
      alert('❌ Error: ' + (errorData.message || 'Failed to send media'));
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api.delete(`/inbox/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete message");
    }
  };

  const handleBlockContact = async (isBlockedStatus) => {
    if (!activeCustomer || activeCustomer.isGroup) return;
    const action = isBlockedStatus ? "Unblock" : "Block";
    
    // Fallback confirmation just in case nicePrompt fails
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this contact?`)) return;

    try {
      await api.put(`/contacts/${activeCustomer._id}`, { isBlocked: !isBlockedStatus });
      
      // Update local state
      setActiveCustomer(prev => ({ ...prev, isBlocked: !isBlockedStatus }));
      
      // Update in customers list
      setCustomers(prev => prev.map(c => 
        c._id === activeCustomer._id ? { ...c, isBlocked: !isBlockedStatus } : c
      ));

      nicePrompt.success("Success", `Contact has been ${action.toLowerCase()}ed.`);
    } catch (error) {
      console.error(`Failed to ${action.toLowerCase()} contact:`, error);
      nicePrompt.error("Error", `Failed to ${action.toLowerCase()} contact.`);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeCustomer || isSending) return;
    setIsSending(true);

    const payload = { text };

    // Handle group vs individual message
    if (activeCustomer.isGroup) {
      payload.groupId = activeCustomer._id;
      console.log('📱 Sending message to group:', activeCustomer.name);
    } else {
      payload.customerId = activeCustomer._id;
      console.log('👤 Sending message to contact:', activeCustomer.name);
    }

    try {
      const res = await api.post("/inbox/send", payload);

      // ✅ SUCCESS Handling
      if (res.data.success) {
        // Only append to UI if we got the saved message back
        if (res.data.msg) {
          setMessages((p) => [...p, res.data.msg]);
        }
        setText("");
        fetchCustomers(); // Refresh list
        console.log('✅ Message delivered successfully to WhatsApp', res.data.messageId);
      }
    } catch (error) {
      console.error('❌ Message delivery failed:', error.response?.data || error.message);
      const errorData = error.response?.data || {};

      // 🔥 Handle specific WhatsApp errors
      if (errorData.error === 'WHATSAPP_SESSION_INACTIVE') {
        alert('🚫 ' + (errorData.message || 'Session inactive'));
        setSendMode('template');
      } else if (errorData.error === 'WHATSAPP_DELIVERY_FAILED') {
        alert('❌ Delivery Failed: ' + (errorData.message || 'Unknown error'));
      } else {
        alert('❌ Error: ' + (errorData.error || errorData.message || 'Failed to send message'));
      }
    } finally {
      setIsSending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const sendTemplateMessage = async () => {
    if (!selectedTemplateId || !activeCustomer || isSending) return;
    setIsSending(true);

    // Get selected template
    const selectedTemplate = templates.find(t => t._id === selectedTemplateId);
    if (!selectedTemplate) {
      setIsSending(false);
      return;
    }

    try {
      // Process template variables
      const processed = processTemplateVariables(
        selectedTemplate.body,
        activeCustomer,
        currentUser || {}
      );

      // Simple validation: check if all manual variables have values
      const missingVars = processed.manualVariables.filter(v => !templateParams[v.variable]);
      if (missingVars.length > 0) {
        alert(`Please fill the following variables: ${missingVars.map(v => v.variable).join(", ")}`);
        setIsSending(false);
        return;
      }

      // Build final parameters (auto + manual)
      const finalParams = buildFinalParameters(processed, templateParams);

      const payload = {
        templateId: selectedTemplateId,
        parameters: finalParams,
        headerImageId: selectedTemplate.header?.type === 'image' ? selectedTemplate.header.metaMediaId : null,
        headerOverrideUrl: headerOverrideUrl || null,
        catalogThumbnailSku: selectedProductSku || null
      };

      if (activeCustomer.isGroup) {
        payload.groupId = activeCustomer._id;
      } else {
        payload.customerId = activeCustomer._id;
      }

      const res = await api.post("/inbox/send-template", payload);

      if (res.data.success) {
        if (res.data.msg) {
          setMessages((p) => [...p, res.data.msg]);
        }
        fetchCustomers();

        setLocalTemplateSessions(prev => ({
          ...prev,
          [activeCustomer._id]: new Date().toISOString()
        }));

        setShowTemplateModal(false);
        setSendMode("text");

        // Reset template selection states
        setSelectedTemplateId("");
        setTemplateParams({});
        setProcessedTemplate(null);
        setPasteValue("");
        setShowPasteModal(false);
        setHeaderOverrideUrl("");

        fetchCustomers();
      } else {
        alert(`❌ Failed to send template: ${res.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Template send failed:', error);
      const errorMsg = error.response?.data?.error || error.message || "Failed to send template";
      alert(`❌ Error: ${errorMsg}`);
    } finally {
      setIsSending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // 🤖 MAGIC AUTO FILL LOGIC
  const handleMagicFill = () => {
    if (!processedTemplate) return;

    const body = templates.find(t => t._id === selectedTemplateId)?.body || "";
    const newParams = { ...templateParams };

    processedTemplate.manualVariables.forEach((v) => {
      const varKey = v.variable;
      const lowerBody = body.toLowerCase();

      // Smart Guessing Based on Context
      if (lowerBody.includes("order")) {
        newParams[varKey] = "ORD-" + Math.floor(1000 + Math.random() * 9000);
      } else if (lowerBody.includes("status")) {
        newParams[varKey] = "Confirmed";
      } else if (lowerBody.includes("link") || lowerBody.includes("url") || lowerBody.includes("click")) {
        newParams[varKey] = "https://zepofy.com/track";
      } else if (lowerBody.includes("date") || lowerBody.includes("time")) {
        newParams[varKey] = new Date().toLocaleDateString('en-GB');
      } else if (lowerBody.includes("amount") || lowerBody.includes("rs") || lowerBody.includes("$")) {
        newParams[varKey] = "999";
      } else {
        newParams[varKey] = `Value ${varKey}`;
      }
    });

    setTemplateParams(newParams);
  };

  // 📋 BULK PASTE LOGIC
  const applyBulkPaste = () => {
    if (!processedTemplate || !pasteValue) return;

    const lines = pasteValue.split("\n").map(l => l.trim()).filter(l => l !== "");
    const manualVars = processedTemplate.manualVariables;
    const newParams = { ...templateParams };

    manualVars.forEach((v, index) => {
      if (index < lines.length) {
        if (index === manualVars.length - 1 && mergeRemaining && lines.length > manualVars.length) {
          // Merge remaining lines into last variable
          newParams[v.variable] = lines.slice(index).join(" ");
        } else {
          newParams[v.variable] = lines[index];
        }
      } else if (!skipExtraLines) {
        // Keep empty if no more lines and not skipping
      }
    });

    setTemplateParams(newParams);
    setShowPasteModal(false);
  };

  const addTag = async () => {
    if (!newTag.trim() || !activeCustomer) return;

    try {
      const updatedTags = [...(activeCustomer.tags || []), newTag.trim()];

      // Update backend
      const res = await api.put(`/contacts/${activeCustomer._id}`, { tags: updatedTags });

      // ✅ Update frontend state immediately with backend response
      setActiveCustomer(res.data.contact || res.data);

      // ✅ Update customers list to reflect changes
      setCustomers(prev => prev.map(c =>
        c._id === activeCustomer._id ? { ...c, tags: updatedTags } : c
      ));

      // ✅ Refresh contact list to update ordering
      fetchCustomers();

      setNewTag("");
      setShowAddTag(false);

      console.log('✅ Tag added successfully:', newTag.trim());
    } catch (error) {
      console.error('❌ Failed to add tag:', error);
      alert('Failed to add tag. Please try again.');
    }
  };

  const assignGroup = async () => {
    if (!selectedGroupId || !activeCustomer) return;

    try {
      // Update backend
      const res = await api.put(`/contacts/${activeCustomer._id}/groups`, { groupId: selectedGroupId });

      // ✅ Update frontend state immediately with backend response
      setActiveCustomer(res.data.contact || res.data);

      // ✅ Update customers list
      setCustomers(prev => prev.map(c =>
        c._id === activeCustomer._id ? (res.data.contact || res.data) : c
      ));

      // ✅ Refresh groups to get updated data
      fetchGroups();

      // ✅ Refresh contact list to update ordering
      fetchCustomers();

      setSelectedGroupId("");
      setShowAssignGroup(false);

      console.log('✅ Group assigned successfully');
    } catch (error) {
      console.error('❌ Failed to assign group:', error);
      alert('Failed to assign group. Please try again.');
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !activeCustomer) return;

    try {
      // Update backend
      const res = await api.put(`/contacts/${activeCustomer._id}`, { notes: newNote.trim() });

      // ✅ Update frontend state immediately with backend response
      setActiveCustomer(res.data.contact || res.data);

      // ✅ Update customers list
      setCustomers(prev => prev.map(c =>
        c._id === activeCustomer._id ? { ...c, notes: newNote.trim() } : c
      ));

      // ✅ Refresh contact list to update ordering
      fetchCustomers();

      setNewNote("");
      setShowAddNote(false);

      console.log('✅ Note added successfully');
    } catch (error) {
      console.error('❌ Failed to add note:', error);
      alert('Failed to add note. Please try again.');
    }
  };

  const addMembersToGroup = async () => {
    if (!activeCustomer || !activeCustomer.isGroup || selectedMembers.length === 0) return;

    try {
      const res = await api.post("/groups/add-members", {
        groupId: activeCustomer._id,
        members: selectedMembers
      });

      if (res.data.success) {
        // Update active customer with new member list
        const updatedGroup = res.data.group;
        setActiveCustomer({ ...updatedGroup, isGroup: true });

        // Update groups list
        setGroups(prev => prev.map(g =>
          g._id === activeCustomer._id ? updatedGroup : g
        ));

        setShowAddMembersModal(false);
        setSelectedMembers([]);
        console.log('✅ Members added successfully to group');
      }
    } catch (error) {
      console.error('❌ Failed to add members:', error);
      alert('Failed to add members. Please try again.');
    }
  };

  const fetchGroups = async () => {
    try {
      // Try different possible endpoints for groups
      let res;
      try {
        res = await api.get("/contact-groups");
      } catch (err) {
        console.log("Trying alternative endpoint for groups...");
        res = await api.get("/groups");
      }

      // Handle different response structures
      const groupsData = res.data?.groups || res.data || [];
      setGroups(groupsData);
      console.log('✅ Groups loaded:', groupsData.length);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      setGroups([]); // Set empty array to prevent errors
    }
  };

  const fetchCustomers = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setIsFiltering(true);
      const currentPage = isLoadMore ? page + 1 : 1;

      // Build query params
      const params = {
        page: currentPage,
        limit: 50,
        search: search.trim(),
        ...filters,
        tags: filters.tags.join(',')
      };

      // Clean up empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === 'all' || (Array.isArray(params[key]) && params[key].length === 0)) {
          delete params[key];
        }
      });

      const res = await api.get("/contacts", { params });

      let contactsData = [];
      if (res.data?.contacts) contactsData = res.data.contacts;
      else if (Array.isArray(res.data)) contactsData = res.data;
      else if (res.data?.success && res.data?.contacts) contactsData = res.data.contacts;

      if (isLoadMore) {
        setCustomers(prev => [...prev, ...contactsData]);
      } else {
        setCustomers(contactsData);
      }

      setTotalContacts(res.data.total || contactsData.length);
      setHasMore(contactsData.length === 50);
      setPage(currentPage);

      console.log('✅ Customers fetched:', contactsData.length, 'Total:', res.data.total);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setIsFiltering(false);
    }
  };


  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates");
      console.log('🔍 RAW TEMPLATES RESPONSE:', res.data);

      // Handle different response structures
      let templatesData = [];
      if (res.data?.templates) {
        templatesData = res.data.templates;
      } else if (Array.isArray(res.data)) {
        templatesData = res.data;
      } else if (res.data?.success && res.data?.templates) {
        templatesData = res.data.templates;
      } else {
        console.warn('Unexpected templates response structure:', res.data);
        templatesData = [];
      }

      // ✅ PROCESS IMAGE URLS FOR TEMPLATES
      const processedTemplates = templatesData.map(template => {
        if (template.header?.type === 'image' && template.header?.image) {
          return {
            ...template,
            header: {
              ...template.header,
              image: getImageUrl(template.header.image)
            }
          };
        }
        return template;
      });

      setTemplates(processedTemplates);
      console.log('✅ Templates loaded:', processedTemplates.length);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      setTemplates([]); // Set empty array to prevent errors
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      console.log('🔍 CURRENT USER RESPONSE:', res.data);
      const userData = res.data?.user || res.data;
      setCurrentUser(userData);

      // Check if user is authenticated
      if (!userData || !userData._id) {
        console.warn('⚠️ User not authenticated or invalid response');
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      if (error.response?.status === 401) {
        console.warn('🔐 Authentication failed - user may need to login');
      }
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check authentication first
        await fetchCurrentUser();

        // Load data in parallel
        const [contactsRes] = await Promise.all([
          fetchCustomers(),
          fetchGroups(),
          fetchTemplates()
        ]);

        console.log('✅ All initial data loaded successfully');

        // 🔥 PERSISTENCE: Restore active chat if it exists in localStorage
        const savedId = localStorage.getItem("activeCustomerId");
        if (savedId) {
          console.log("🔄 Restoring active chat from session:", savedId);
          // We need to wait a bit for setCustomers to take effect
          setTimeout(() => {
            setCustomers(prev => {
              const savedContact = prev.find(c => c._id === savedId);
              if (savedContact) {
                setActiveCustomer(savedContact);
                loadMessages(savedId);
              }
              return prev;
            });
          }, 100);
        }
      } catch (err) {
        console.error('❌ Failed to load initial data:', err);
        setError('Failed to load data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    // 🔔 Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 🔥 TRIGGER FETCH ON FILTER CHANGE
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 400);
    return () => clearTimeout(timer);
  }, [filters, search]);

  const sortedCustomers = [...customers]; // Sorting handled by backend now

  return (
    <>
      <style>{`
        .messages-page-font {
          font-family: 'Poppins', sans-serif;
        }

        .heading-font {
          font-family: 'Poppins', sans-serif;
        }

        .whatsapp-chat-bg {
          position: absolute;
          inset: 0;
          background-color: #f8fafc;
          background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.5;
          z-index: 0;
          pointer-events: none;
        }

        .message-bubble {
          position: relative;
          max-width: 80%;
          padding: 10px 16px;
          border-radius: 16px;
          font-size: 14.5px;
          line-height: 1.5;
          z-index: 10;
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.05);
          word-break: break-word;
          transition: transform 0.2s ease;
        }

        .message-outgoing {
          background-color: #d9fdd3;
          color: #111b21;
          border-bottom-right-radius: 4px;
          align-self: flex-end;
          margin-right: 4px;
        }

        .message-incoming {
          background-color: #ffffff;
          color: #1e293b;
          border: 1px solid #f1f5f9;
          border-bottom-left-radius: 4px;
          align-self: flex-start;
          margin-left: 4px;
          box-shadow: 0 4px 12px -4px rgba(0,0,0,0.05);
        }

        .message-time {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          font-size: 11px;
          color: #667781;
          margin-top: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ced3d6;
          border-radius: 10px;
        }

        .contact-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .contact-item::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 0;
          background: #4f46e5;
          transition: width 0.2s ease;
        }
        .contact-item.active {
          background-color: #eef2ff !important;
        }
        .contact-item.active::before {
          width: 4px;
        }
        .contact-item:hover:not(.active) {
          background-color: #f8fafc;
        }

        .chat-input-sticky {
          position: sticky;
          bottom: 0;
          z-index: 30;
        }
      `}</style>

      <div
        className="h-[calc(100vh-64px)] flex w-full overflow-hidden bg-[#f0f2f5] messages-page-font"
      >

        {/* ================= LEFT CONTACT LIST ================= */}
        <aside
          className={`bg-white border-r border-slate-200 flex flex-col z-[10] relative shadow-sm transition-all duration-300
                ${windowWidth < 768 ? (mobileView === 'list' ? 'w-full' : 'hidden') : 'w-[320px]'}
            `}
        >
          {/* List Header */}
          <div className="h-[58px] px-5 flex items-center justify-between bg-white shrink-0">
            <h1 className="text-xl font-bold text-[#111b21] heading-font tracking-tight">Live Chat</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterPanel(true)}
                className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
                title="Advanced Filters"
              >
                <FiFilter size={18} />
                {(Object.values(filters).some(v => v && v !== 'all' && (!Array.isArray(v) || v.length > 0))) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setShowAddContact(true)}
                className="w-9 h-9 flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                title="New Chat"
              >
                <FiPlus size={20} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-2 shrink-0 border-b border-slate-50">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <FiSearch className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search name or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[12px] text-[13px] font-medium focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Active Filter Chips */}
          {Object.values(filters).some(v => v !== 'all' && v !== '' && v.length !== 0) && (
            <div className="px-4 py-2 border-b border-slate-50 bg-white flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar shrink-0">
              {Object.entries(filters).map(([key, value]) => {
                if (value === 'all' || value === '' || (Array.isArray(value) && value.length === 0)) return null;

                let displayValue = value;
                if (key === 'unread') displayValue = 'Unread Only';
                if (key === 'replyStatus') displayValue = `Status: ${value}`;
                if (key === 'dateRange') displayValue = `Date: ${value}`;
                if (key === 'tags') displayValue = `${value.length} Tags`;

                return (
                  <div key={key} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100 uppercase tracking-tighter">
                    <span>{displayValue}</span>
                    <button onClick={() => setFilters(prev => ({ ...prev, [key]: Array.isArray(value) ? [] : (key === 'unread' || key === 'replyStatus' || key === 'dateRange' ? 'all' : '') }))}>
                      <FiX size={10} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setFilters({ dateRange: 'all', replyStatus: 'all', unread: 'all', campaignId: '', campaignReply: '', assignedTo: '', flowStatus: '', messageType: '', contactType: '', tags: [] })}
                className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase px-2 py-1 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 py-2 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl mb-3 border border-slate-200 shadow-inner">
              <button
                onClick={() => setActiveTab("contacts")}
                className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${activeTab === "contacts" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Direct Chats
              </button>
              <button
                onClick={() => setActiveTab("groups")}
                className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${activeTab === "groups" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Groups
              </button>
            </div>
          </div>

          {/* List Body */}
          <div
            className="flex-1 overflow-y-auto custom-scrollbar"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !isFiltering) {
                fetchCustomers(true);
              }
            }}
          >
            {isFiltering && page === 1 ? (
              <div className="flex flex-col items-center justify-center h-48 opacity-60">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-[13px] font-medium text-slate-500">Filtering contacts...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 opacity-40">
                <span className="text-[14px]">No chats found</span>
              </div>
            ) : (
              activeTab === 'contacts' ? (
                <>
                  {sortedCustomers.map((c) => {
                    const isActive = activeCustomer?._id === c._id;
                    const unread = c.unreadCount > 0;
                    const lastMessageText = c.lastMessage || c.phone;
                    const lastMessageTime = c.lastMessageTime ? new Date(c.lastMessageTime) : null;
                    return (
                      <div
                        key={c._id}
                        onClick={() => selectCustomer(c)}
                        className={`contact-item flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-50 relative transition-all ${isActive ? 'active' : ''}`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f8fafc&color=475569&bold=true&size=128`}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h3 className={`text-[15px] font-medium truncate pr-2 ${isActive ? 'text-indigo-900 font-bold' : 'text-slate-900'}`}>{c.name}</h3>
                            <span className={`text-[11px] whitespace-nowrap shrink-0 ${c.unreadCount > 0 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>
                              {(() => {
                                if (!lastMessageTime) return 'Recent';
                                const now = new Date();
                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const yesterday = new Date(today);
                                yesterday.setDate(yesterday.getDate() - 1);

                                const msgDate = new Date(lastMessageTime.getFullYear(), lastMessageTime.getMonth(), lastMessageTime.getDate());

                                if (msgDate.getTime() === today.getTime()) {
                                  return lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                } else if (msgDate.getTime() === yesterday.getTime()) {
                                  return 'Yesterday';
                                } else if (now.getTime() - lastMessageTime.getTime() < 7 * 24 * 60 * 60 * 1000) {
                                  return lastMessageTime.toLocaleDateString([], { weekday: 'short' });
                                } else {
                                  return lastMessageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                }
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className={`text-[13px] font-[400] truncate mt-[1px] ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                              {lastMessageText}
                            </p>
                            {c.unreadCount > 0 && (
                              <span className="bg-indigo-600 text-white text-[10px] font-semibold h-5 min-w-[20px] flex items-center justify-center px-1.5 rounded-full shadow-sm">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isFiltering && page > 1 && (
                    <div className="py-6 flex flex-col items-center gap-2 opacity-60">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-tighter">Loading more...</span>
                    </div>
                  )}
                </>
              ) : (
                groups.map(group => {
                  const isActive = activeCustomer?._id === group._id && activeCustomer.isGroup;
                  const unread = group.unreadCount > 0;
                  return (
                    <div
                      key={group._id}
                      onClick={() => selectGroup(group)}
                      className={`contact-item flex items-center gap-3.5 px-3.5 py-3 border-b border-slate-50 relative transition-all ${isActive ? 'active' : ''}`}
                    >
                      <div className="shrink-0 relative">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-100 shadow-sm">
                          <FiUsers size={20} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className={`text-[15px] truncate ${isActive ? 'text-indigo-900 font-bold' : 'font-medium text-slate-900'}`}>{group.name}</h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] truncate mt-[1px] ${isActive ? 'text-indigo-700' : 'font-[400] text-slate-500'}`}>
                            {group.membersCount || group.memberCount || 0} participants
                          </p>
                          {unread && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold h-5 min-w-[20px] flex items-center justify-center px-1 rounded-full shadow-sm">
                              {group.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </aside>



        <section
          className={`flex-1 min-w-0 flex flex-col bg-white h-full relative overflow-hidden transition-all duration-300
                ${windowWidth < 768 && mobileView === 'list' ? 'hidden' : 'flex'}
            `}
        >
          {/* Chat Header */}
          <div className="h-[58px] px-4 flex items-center bg-[#f0f2f5] border-b border-[#d1d7db] z-[50] shrink-0">
            {activeCustomer ? (
              <>
                {/* Back button for mobile */}
                {windowWidth < 768 && (
                  <button
                    onClick={() => setMobileView('list')}
                    className="mr-3 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <FiChevronLeft size={24} />
                  </button>
                )}
                <div
                  className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                  onClick={() => setShowContactInfo(!showContactInfo)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 border border-slate-100 transition-all group-hover:border-indigo-200">
                    {activeCustomer.isGroup ? (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <FiUsers className="w-5 h-5 text-slate-400" />
                      </div>
                    ) : (
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeCustomer.name)}&background=f1f5f9&color=64748b&bold=true&size=100`} alt={activeCustomer.name} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold font-poppins text-slate-900 leading-tight truncate">
                      {activeCustomer.name}
                    </h2>
                    {!activeCustomer.isGroup && (
                      <p className="text-[12px] font-bold font-poppins text-slate-500/80 tracking-tight mt-0.5">
                        {activeCustomer.phone?.startsWith('+') ? activeCustomer.phone : `+${activeCustomer.phone}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowContactInfo(!showContactInfo)} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors">
                    <FiChevronRight size={22} className={`transition-transform duration-300 ${showContactInfo ? 'rotate-0' : 'rotate-180'}`} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1" />
            )}
          </div>

          {!activeCustomer ? (
            <div
              ref={chatContainerRef}
              className="absolute inset-0 overflow-y-auto z-10 custom-scrollbar"
            >
              <div className="flex flex-col items-center justify-center h-full text-center relative z-10 px-6">
                <div className="w-56 h-56 mb-8 opacity-[0.08] grayscale drop-shadow-xl">
                  <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5y9Z.png" alt="Zepofy AI" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-2xl font-light text-slate-400 mb-3 tracking-tight">Zepofy Web</h1>
                <p className="text-[14px] text-slate-400 max-w-sm leading-relaxed">
                  Select a conversation to start messaging. Your chats are secure and synchronized across all devices.
                </p>
                <div className="mt-10 flex items-center gap-2 text-[11px] text-slate-300 font-medium uppercase tracking-widest">
                  <FiLock size={12} />
                  <span>End-to-end encrypted messaging</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 relative overflow-hidden">
                <div className="whatsapp-chat-bg" />
                <div
                  ref={chatContainerRef}
                  className="absolute inset-0 overflow-y-auto z-10 custom-scrollbar"
                >
                  <div className="w-full flex flex-col p-4 md:p-8 space-y-1 relative z-10">
                    {messages.length === 0 ? (
                      <div className="flex justify-center mt-4">
                        <div className="bg-[#fff9c2] text-[#54656f] text-[12px] px-4 py-1.5 rounded-lg shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-[#e1d99d] flex items-center gap-2">
                          <FiLock size={12} />
                          <span>Messages are secured and encrypted</span>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const grouped = [];
                        let lastDateStr = null;

                        messages.forEach((msg) => {
                          const date = new Date(msg.createdAt);
                          const dateStr = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });

                          const today = new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });

                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          const yesterdayStr = yesterday.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });

                          let displayDate = dateStr;
                          if (dateStr === today) displayDate = 'TODAY';
                          else if (dateStr === yesterdayStr) displayDate = 'YESTERDAY';

                          if (displayDate !== lastDateStr) {
                            grouped.push({ type: 'date_header', date: displayDate });
                            lastDateStr = displayDate;
                          }
                          grouped.push({ type: 'message', ...msg });
                        });

                        return grouped.map((item, index) => {
                          if (item.type === 'date_header') {
                            return (
                              <div key={`date-${index}`} className="py-6 flex justify-center w-full">
                                <div className="bg-[#e1f3fb] text-[#54656f] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-widest border border-[#d1e7f0] backdrop-blur-md bg-opacity-90">
                                  {item.date}
                                </div>
                              </div>
                            );
                          }

                          const msg = item;
                          const outgoing = msg.sender === "user" || msg.sender === "business" || msg.direction === "outgoing";
                          const isTemplate = msg.type === "template" || msg.template?.body;

                          const isTemplateName = (str) => {
                            if (!str || typeof str !== 'string') return false;
                            return str.includes('_template') || str.match(/^[a-z_]+_template/i) || (str.match(/^[A-Za-z_]+$/)) && str.length < 50 && str.includes('_');
                          };

                          const getTemplateBody = () => {
                            if (msg.body && typeof msg.body === 'string' && !isTemplateName(msg.body)) return msg.body;
                            if (msg.template?.components) {
                              const bodyComponent = msg.template.components.find(c => c.type === "BODY");
                              if (bodyComponent?.text && !isTemplateName(bodyComponent.text)) return bodyComponent.text;
                            }
                            return msg.template?.body || msg.text || null;
                          };

                          return (
                            <div
                              key={msg._id || index}
                              className={`flex mb-1 ${outgoing ? "justify-end" : "justify-start"}`}
                            >
                              {isTemplate ? (
                                <TemplateMessageBubble
                                  msg={{
                                    ...msg,
                                    outgoing,
                                    headerImage: msg.headerImage || msg.image,
                                    body: getTemplateBody(),
                                    footer: msg.footer || msg.template?.footer,
                                    buttons: msg.buttons || (msg.template?.components?.find(c => c.type === "BUTTONS")?.buttons)
                                  }}
                                />
                              ) : (
                                <div className={`message-bubble group ${outgoing ? "message-outgoing" : "message-incoming shadow-sm"}`}>
                                  {!outgoing && activeCustomer.isGroup && (
                                    <div className="text-[12.5px] font-bold text-indigo-600 mb-0.5 cursor-pointer hover:underline">
                                      {msg.senderName || msg.sender || "User"}
                                    </div>
                                  )}

                                  <div className="relative">
                                    {msg.type === "image" ? (
                                      <div className="flex flex-col gap-1 w-full max-w-[260px] sm:max-w-[300px]">
                                        <img
                                          src={getImageUrl(msg.mediaUrl || msg.image)}
                                          alt="Image"
                                          className="rounded-[8px] max-h-[300px] w-full object-contain cursor-pointer hover:brightness-95 transition-all outline outline-1 outline-slate-100"
                                          onClick={() => window.open(getImageUrl(msg.mediaUrl || msg.image), '_blank')}
                                        />
                                        {(msg.caption || msg.text || msg.body || msg.message) && (
                                          <p className={`text-[13.5px] px-1 font-poppins mt-1.5 leading-relaxed [overflow-wrap:anywhere] break-words ${outgoing ? 'text-[#111b21]' : 'text-slate-800'}`}>
                                            {msg.caption || msg.text || msg.body || msg.message}
                                          </p>
                                        )}
                                      </div>
                                    ) : msg.type === "document" ? (
                                      <div
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${outgoing ? 'bg-[#00a884]/10 border-[#00a884]/30 hover:bg-[#00a884]/20' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                                        onClick={() => window.open(getImageUrl(msg.mediaUrl), '_blank')}
                                      >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${outgoing ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-indigo-100 text-indigo-600'}`}>
                                          <FiFileText size={20} />
                                        </div>
                                        <div className="min-w-0 pr-2">
                                          <p className={`text-[13px] font-semibold truncate leading-tight ${outgoing ? 'text-[#111b21]' : 'text-slate-800'}`}>
                                            {msg.filename || "Document"}
                                          </p>
                                          <p className={`text-[11px] mt-1 uppercase font-bold tracking-wider ${outgoing ? 'text-slate-500' : 'text-slate-500'}`}>
                                            {msg.filename?.split('.').pop() || "PDF"}
                                          </p>
                                        </div>
                                        <div className={`ml-auto p-1.5 transition-colors ${outgoing ? 'text-slate-400 hover:text-[#00a884]' : 'text-slate-400 hover:text-indigo-600'}`}>
                                          <FiDownload size={16} />
                                        </div>
                                      </div>
                                    ) : (msg.type === "audio" || msg.type === "voice") ? (
                                      <div className="flex flex-col gap-2 p-1 min-w-[240px] sm:min-w-[280px]">
                                        <audio
                                          controls
                                          controlsList="nodownload"
                                          className="h-10 w-full"
                                          src={getImageUrl(msg.mediaUrl || msg.audio)}
                                        >
                                          Your browser does not support the audio element.
                                        </audio>
                                      </div>
                                    ) : msg.type === "video" ? (
                                      <div className="flex flex-col gap-1 w-full max-w-[300px]">
                                        <video
                                          controls
                                          className="rounded-[8px] w-full max-h-[300px] bg-black outline outline-1 outline-slate-100"
                                          src={getImageUrl(msg.mediaUrl || msg.video)}
                                        />
                                        {(msg.caption || msg.text || msg.body) && (
                                          <p className={`text-[13.5px] px-1 font-poppins mt-1.5 leading-relaxed [overflow-wrap:anywhere] break-words ${outgoing ? 'text-[#111b21]' : 'text-slate-800'}`}>
                                            {msg.caption || msg.text || msg.body}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1 w-full max-w-[320px]">
                                        {/* Handle Native Flow Rendering */}
                                        {(msg.text?.startsWith('[WhatsApp Flow:') || msg.body?.startsWith('[WhatsApp Flow:')) ? (
                                          (() => {
                                            const content = msg.body || msg.text;
                                            const headerMatch = content.match(/\[WhatsApp Flow: (.*?)\]/);
                                            const buttonMatch = content.match(/🔗 Button: (.*)/);
                                            const headerText = headerMatch ? headerMatch[1] : "Form";
                                            const buttonText = buttonMatch ? buttonMatch[1] : "Open Form";
                                            let bodyText = content.replace(/\[WhatsApp Flow: .*?\]\n/, '').replace(/\n🔗 Button: .*/, '');
                                            
                                            return (
                                              <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-1 opacity-80">
                                                  <FiLayers size={14} className={outgoing ? 'text-slate-500' : 'text-slate-500'} />
                                                  <span className="text-[12px] font-bold">{headerText}</span>
                                                </div>
                                                <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] break-words pr-2">
                                                  {bodyText}
                                                </p>
                                                <div className={`flex flex-col gap-1 mt-2 border-t pt-2 -mx-1 ${outgoing ? 'border-[rgba(0,0,0,0.06)]' : 'border-slate-100'}`}>
                                                  <div className={`text-center py-2.5 font-bold text-[13px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm
                                                      ${outgoing ? 'text-[#00a884] bg-transparent hover:bg-[rgba(0,0,0,0.04)]' : 'text-[#00a884] bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                                                    `}
                                                  >
                                                    <span className="text-[15px]">📋</span>
                                                    <span>{buttonText}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <>
                                            <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] break-words pr-2">
                                              {msg.body || msg.text || msg.message || ""}
                                            </p>

                                            {/* Render Interactive Buttons */}
                                            {(msg.buttons && msg.buttons.length > 0) && (
                                              <div className={`flex flex-col gap-1 mt-2 border-t pt-2 -mx-1 ${outgoing ? 'border-[rgba(0,0,0,0.06)]' : 'border-slate-100'}`}>
                                                {msg.buttons.map((b, idx) => (
                                                  <div
                                                    key={idx}
                                                    className={`text-center py-2 font-semibold text-[13px] rounded-lg transition-colors cursor-default border border-transparent
                                                      ${outgoing ? 'text-[#00a884] bg-transparent hover:bg-[rgba(0,0,0,0.04)] border-transparent' : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-100'}
                                                    `}
                                                  >
                                                    {b?.reply?.title || b?.text || b?.title || "Button"}
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Render Interactive List Menu */}
                                            {(msg.type === "list_reply" || msg.type === "interactive_list" || (msg.type === "interactive" && !msg.buttons && !msg.text?.startsWith('[WhatsApp Flow:'))) && (
                                              <div className={`flex flex-col gap-1 mt-2 border-t pt-2 -mx-1 ${outgoing ? 'border-[rgba(0,0,0,0.06)]' : 'border-slate-100'}`}>
                                                <div className={`text-center py-2.5 font-bold text-[13px] rounded-lg transition-all cursor-pointer border flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]
                                                    ${outgoing ? 'text-[#00a884] bg-transparent border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.04)]' : 'text-indigo-600 bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'}
                                                  `}
                                                >
                                                  <span className="text-[16px]">☰</span>
                                                  <span>{msg.buttonText || "View Menu"}</span>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}

                                        {/* Render Footer */}
                                        {msg.footer && (
                                          <span className="text-[10.5px] text-slate-400 mt-0.5">{msg.footer}</span>
                                        )}
                                      </div>
                                    )}


                                    <div className={`flex items-center justify-end gap-1 mt-1 ${outgoing ? 'text-black/60' : 'text-slate-400'}`}>
                                      <span className="text-[10px] font-medium font-poppins opacity-90 mt-0.5">
                                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                      </span>
                                      {outgoing && (
                                        <div className="flex items-center shrink-0">
                                          {msg.status === "read" ? (
                                            <div className="flex items-center text-[#34b7f1]">
                                              <FiCheck size={14} className="-mr-1.5" strokeWidth={3} />
                                              <FiCheck size={14} strokeWidth={3} />
                                            </div>
                                          ) : msg.status === "delivered" ? (
                                            <div className="flex items-center text-black/40">
                                              <FiCheck size={14} className="-mr-1.5" />
                                              <FiCheck size={14} />
                                            </div>
                                          ) : msg.status === "failed" ? (
                                            <FiAlertCircle size={12} className="text-red-500" />
                                          ) : (
                                            <FiCheck size={14} className="text-black/30" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()
                    )}
                    <div ref={bottomRef} className="h-6" />
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="bg-white border-t border-slate-100 shrink-0 relative z-20">
                {/* 🛑 24-HOUR WINDOW BANNER */}
                {!isTextMessagingAllowed() && !activeCustomer.isGroup && (
                  <div className="bg-amber-50 border-b border-amber-100 px-6 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FiClock className="text-amber-500 w-4 h-4" />
                      <p className="text-[12px] font-semibold text-amber-800">
                        24-hour window closed.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    >
                      SEND TEMPLATE
                    </button>
                  </div>
                )}

                <div className="px-4 py-2 relative bg-[#f0f2f5]">
                  {/* Image Preview Modal */}
                  {previewImage && createPortal(
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-500 overflow-hidden">
                      <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/20 p-5 w-full max-w-[380px] animate-in fade-in zoom-in duration-300 relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[17px] font-bold text-slate-900 font-poppins tracking-tight">Send Image</h3>
                          <button onClick={() => setPreviewImage(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <FiX size={18} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shadow-inner group relative">
                            <img
                              src={previewImage.previewUrl || previewImage}
                              alt="Preview"
                              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                          </div>

                          <div className="space-y-3">
                            <div className="relative group">
                              <input
                                type="text"
                                placeholder="Add a caption..."
                                value={imageCaption}
                                onChange={(e) => setImageCaption(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && uploadAndSendImage()}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-[14px] font-medium placeholder:text-slate-400"
                                autoFocus
                              />
                            </div>

                            <button
                              onClick={uploadAndSendImage}
                              disabled={isUploading}
                              className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[14px] transition-all duration-300 active:scale-95 shadow-lg ${isUploading
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200/50"
                                }`}
                            >
                              {isUploading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <FiSend size={16} />
                                  <span>Send to Chat</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                  {/* Hidden Input for Images */}
                  <input type="file" ref={imageInputRef} style={{ display: 'none' }} accept="image/jpeg,image/png,image/jpg,image/webp" onChange={handleImageSelect} />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="p-2.5 text-[#54656f] hover:bg-slate-200/50 rounded-full transition-all"
                      title="Attach Image"
                    >
                      <FiPlus size={24} />
                    </button>

                    <button
                      onClick={async () => {
                        setShowFlowModal(true);
                        try {
                          const res = await api.get('/whatsapp-flows');
                          if (res.data.success) {
                            const fetchedFlows = res.data.data || res.data.flows || [];
                            setPublishedFlows(fetchedFlows.filter(f => f.status === 'PUBLISHED' || f.status === 'APPROVED'));
                          }
                        } catch (e) {
                          console.error("Failed to load flows", e);
                        }
                      }}
                      className="p-2.5 text-indigo-600 hover:bg-slate-200/50 rounded-full transition-all"
                      title="Send WhatsApp Flow"
                    >
                      <FiLayers size={22} />
                    </button>

                    <div className="relative">
                      {showEmojiPicker && (
                        <div ref={emojiPickerRef} className="absolute bottom-[calc(100%+15px)] left-[-10px] z-[60] shadow-2xl rounded-[12px] overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200 origin-bottom-left">
                          <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            width={320}
                            height={400}
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                          />
                        </div>
                      )}
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2.5 rounded-full transition-all ${showEmojiPicker ? 'text-indigo-600 bg-slate-200/50' : 'text-[#54656f] hover:bg-slate-200/50'}`}
                        title="Emojis"
                      >
                        <FiSmile size={24} />
                      </button>
                    </div>

                    <div className="flex-1 bg-white rounded-full px-4 py-1 flex items-center shadow-sm border border-slate-100">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={activeCustomer.isBlocked || (sendMode === "text" && !isTextMessagingAllowed())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (text.trim()) {
                              sendMode === "template" ? sendTemplateMessage() : sendMessage();
                            }
                          }
                        }}
                        placeholder={activeCustomer.isBlocked ? "Contact blocked" : (sendMode === "text" && !isTextMessagingAllowed() ? "Window closed" : "Type a message..")}
                        className="flex-1 bg-transparent border-none text-[15px] text-[#3b4a54] outline-none resize-none min-h-[40px] max-h-32 py-2.5 placeholder:text-[#8696a0]"
                        rows={1}
                      />
                    </div>

                    <button
                      onClick={() => sendMode === "template" ? sendTemplateMessage() : sendMessage()}
                      disabled={activeCustomer.isBlocked || (!text.trim() && sendMode === "text") || (sendMode === "text" && !isTextMessagingAllowed()) || isSending}
                      className="w-[45px] h-[45px] bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-md flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-indigo-600 transform active:scale-95 shrink-0"
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FiSend size={20} className="translate-x-[1px]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>


        {/* ================= CONTACT INFO PANEL ================= */}
        {activeCustomer && (
          <aside
            className={`bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden flex-shrink-0 transition-all duration-300
                ${windowWidth < 768 ? 'fixed inset-y-0 right-0 w-full z-[60] shadow-2xl' : (windowWidth < 1200 ? 'fixed inset-y-0 right-0 w-[320px] z-40 shadow-2xl' : 'relative w-[320px] z-40')}
                ${showContactInfo ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
            `}
            style={{ width: showContactInfo ? (windowWidth < 768 ? '100%' : '320px') : '0px' }}
          >
            {/* Header - REFINED ALIGNMENT */}
            <div className="h-[58px] px-4 flex items-center bg-[#f0f2f5] border-b border-[#d1d7db] shrink-0 justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-bold text-[#111b21] heading-font tracking-tight ml-2">Contact Info</span>
              </div>

              <button
                onClick={handleClearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all uppercase tracking-wider"
                title="Clear Chat History"
              >
                <FiTrash2 size={13} />
                <span>Clear</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Profile Section - COMPACT */}
              <div className="p-6 pb-4 flex flex-col items-center text-center border-b border-gray-100">
                {activeCustomer.isGroup ? (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mb-3 shadow-md">
                    <FiUsers className="w-7 h-7 text-white" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 mb-3 shadow-md">
                    <img src={`https://ui-avatars.com/api/?name=${activeCustomer.name}&background=4f46e5&color=fff&size=200`} alt={activeCustomer.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <h2 className="text-[16px] font-bold text-slate-900 leading-tight font-poppins">{activeCustomer.name}</h2>
                <p className="text-[13px] text-slate-500 mt-1.5 font-medium font-poppins">
                  {activeCustomer.isGroup
                    ? `${activeCustomer.members?.length || 0} members`
                    : (activeCustomer.phone?.startsWith('+') ? activeCustomer.phone : `+${activeCustomer.phone}`)}
                </p>
              </div>

              {/* Group Members Section */}
              {activeCustomer.isGroup && (
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">
                      Group Members ({activeCustomer.members?.length || 0})
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedMembers([]);
                        setShowAddMembersModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100"
                    >
                      <FiPlus size={10} /> Add Member
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                    {activeCustomer.members && activeCustomer.members.length > 0 ? (
                      activeCustomer.members.map((member) => (
                        <div key={member._id} className="flex items-center gap-3 p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center shrink-0 border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-600">
                              {member.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">{member.name}</p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {member.phone?.startsWith('+') ? member.phone : `+${member.phone}`}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 italic py-2">No members in this group</p>
                    )}
                  </div>
                </div>
              )}

              {/* Block/Unblock Action */}
              {!activeCustomer.isGroup && (
                <div className="px-5 py-3 border-b border-gray-100 flex justify-center">
                  <button
                    onClick={() => handleBlockContact(activeCustomer.isBlocked)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all w-full justify-center border ${
                      activeCustomer.isBlocked 
                        ? 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50' 
                        : 'border-red-100 text-red-600 bg-red-50 hover:bg-red-100'
                    }`}
                  >
                    <FiLock size={16} />
                    {activeCustomer.isBlocked ? "Unblock Contact" : "Block Contact"}
                  </button>
                </div>
              )}

              {/* Contact Intel / Activity Summary */}
              <div className="px-5 py-5 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-poppins">Contact Intel</h3>
                  <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100">
                    Summary
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  {(() => {
                    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                    const lastTemplate = messages.slice().reverse().find(m => m.type === 'template');
                    const lastCampaign = messages.slice().reverse().find(m => m.campaignId); // assuming campaignId is present if it's from a campaign

                    const formatDate = (dateString) => {
                      if (!dateString) return "N/A";
                      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    };

                    return (
                      <>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              <FiMessageSquare size={12} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Last Message</p>
                              <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">
                                {lastMsg ? (lastMsg.direction === 'outgoing' ? 'You sent a message' : 'Customer replied') : 'No messages'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 text-right shrink-0">
                            {lastMsg ? formatDate(lastMsg.createdAt) : '-'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <FiActivity size={12} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Last Campaign</p>
                              <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">
                                {lastCampaign ? (lastCampaign.campaignName || "Campaign Message") : 'No campaigns'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 text-right shrink-0">
                            {lastCampaign ? formatDate(lastCampaign.createdAt) : '-'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                              <FiFileText size={12} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Last Template</p>
                              <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]">
                                {lastTemplate ? (lastTemplate.templateName || "Unknown Template") : 'No templates'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 text-right shrink-0">
                            {lastTemplate ? formatDate(lastTemplate.createdAt) : '-'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={() => {
                    setShowTemplateModal(true);
                    setSelectedTemplateId("");
                    setProcessedTemplate(null);
                  }}
                  className="w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl text-[13px] shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] group cursor-pointer"
                >
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiFileText size={12} />
                  </div>
                  <span>Send Template</span>
                </button>
                <p className="mt-3 text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest">
                  Deploy predefined messaging asset
                </p>
              </div>

              {/* Actions Section - GROUPED & COMPACT */}
              {!activeCustomer.isGroup && (
                <div className="px-5 py-3.5 border-b border-gray-100">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4 font-poppins">User Actions</h3>

                  {/* Tags */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[13px] font-semibold text-slate-700 font-poppins">Tags</span>
                      <button
                        onClick={() => {
                          setShowAddTag(!showAddTag);
                          setShowAssignGroup(false);
                          setShowAddNote(false);
                        }}
                        className="text-indigo-600 hover:text-indigo-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FiPlus size={10} /> Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCustomer.tags?.map(tagName => {
                        const tagObj = globalTags.find(t => t.name === tagName);
                        return (
                          <div
                            key={tagName}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center gap-1 group/tag"
                          >
                            <span>{tagName}</span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const updatedTags = activeCustomer.tags.filter(t => t !== tagName);
                                const res = await api.put(`/contacts/${activeCustomer._id}`, { tags: updatedTags });
                                if (res.data.success) {
                                  const updatedContact = { ...activeCustomer, tags: updatedTags };
                                  setActiveCustomer(updatedContact);
                                  setCustomers(prev => prev.map(c => c._id === activeCustomer._id ? updatedContact : c));
                                }
                              }}
                              className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 transition-all"
                            >
                              <FiX size={10} />
                            </button>
                          </div>
                        );
                      })}
                      {(!activeCustomer.tags || activeCustomer.tags.length === 0) && (
                        <span className="text-[11px] text-gray-400 italic">No tags assigned</span>
                      )}
                    </div>

                    {showAddTag && (
                      <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Tag</span>
                          <button onClick={() => setShowAddTag(false)} className="text-slate-400 hover:text-slate-600"><FiX size={12} /></button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                          {globalTags
                            .filter(tag => !(activeCustomer.tags || []).includes(tag.name))
                            .map(tag => (
                              <button
                                key={tag._id}
                                onClick={async () => {
                                  try {
                                    const updatedTags = [...(activeCustomer.tags || []), tag.name];
                                    const res = await api.put(`/contacts/${activeCustomer._id}`, { tags: updatedTags });
                                    if (res.data.success) {
                                      const updatedContact = { ...activeCustomer, tags: updatedTags };
                                      setActiveCustomer(updatedContact);
                                      setCustomers(prev => prev.map(c => c._id === activeCustomer._id ? updatedContact : c));
                                      setShowAddTag(false);
                                    }
                                  } catch (err) {
                                    console.error("Failed to add tag", err);
                                  }
                                }}
                                className="px-2 py-1 text-[10px] font-medium rounded-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                              >
                                {tag.name}
                              </button>
                            ))}
                          {globalTags.filter(tag => !(activeCustomer.tags || []).includes(tag.name)).length === 0 && (
                            <span className="text-[10px] text-slate-400 italic py-1">All available tags assigned</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Groups */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[13px] font-semibold text-slate-700 font-poppins">Groups</span>
                      <button
                        onClick={() => {
                          setShowAssignGroup(!showAssignGroup);
                          setShowAddTag(false);
                          setShowAddNote(false);
                        }}
                        className="text-indigo-600 hover:text-indigo-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FiPlus size={10} /> Assign
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(() => {
                        const contactGroups = groups.filter(group =>
                          group.contactIds && group.contactIds.includes(activeCustomer._id)
                        );
                        return contactGroups.length > 0 ? (
                          contactGroups.map((group, i) => (
                            <div key={i} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center gap-1 group/group">
                              <span>{group.name}</span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    // Empty groupId on updateContactGroups removes the contact from all groups (this system's pattern)
                                    const res = await api.put(`/contacts/${activeCustomer._id}/groups`, { groupId: "" });
                                    if (res.data.success) {
                                      // Trigger refreshes
                                      fetchGroups();
                                      fetchCustomers();
                                      // Local update for immediate feedback
                                      // Note: activeCustomer itself doesn't store groupId, we calculate it from groups array
                                    }
                                  } catch (err) {
                                    console.error("Failed to remove group", err);
                                  }
                                }}
                                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 transition-all"
                              >
                                <FiX size={10} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">No groups</span>
                        );
                      })()}
                    </div>
                    {showAssignGroup && (
                      <div className="flex gap-2">
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="">Select group</option>
                          {groups.map(g => (
                            <option key={g._id} value={g._id}>{g.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={assignGroup}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Assign
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[13px] font-semibold text-slate-700 font-poppins">Notes</span>
                      <button
                        onClick={() => {
                          setShowAddNote(!showAddNote);
                          setShowAddTag(false);
                          setShowAssignGroup(false);
                        }}
                        className="text-gray-600 hover:text-gray-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FiPlus size={10} /> Add
                      </button>
                    </div>
                    {activeCustomer.notes ? (
                      <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-700 leading-relaxed mb-2">
                        {activeCustomer.notes}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic mb-2 block">No notes</span>
                    )}
                    {showAddNote && (
                      <div className="space-y-2">
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none transition-all resize-none"
                          rows={2}
                          autoFocus
                        />
                        <button
                          onClick={addNote}
                          className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Save Note
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

        )}
      </div >

      {/* ================= ADD CONTACT MODAL - CRITICAL: MUST KEEP ================= */}
      {
        showAddContact && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Professional backdrop with blur */}
              <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl transition-all duration-500"
                onClick={() => setShowAddContact(false)}
              />

              <div
                className="relative bg-white rounded-[16px] w-[450px] h-auto max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="h-[64px] px-6 flex items-center bg-indigo-600 text-white shadow-lg">
                  <h3 className="text-[17px] font-bold heading-font">Add New Contact</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="space-y-1.5">
                    <label className="text-[14px] text-indigo-700 font-medium ml-1">Full Name</label>
                    <div className="relative">
                      <input
                        placeholder="Enter contact name"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        className="w-full px-4 py-3 bg-[#f0f2f5] border-none rounded-[12px] focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] text-indigo-700 font-medium ml-1">Phone Number (with country code)</label>
                    <div className="relative">
                      <input
                        placeholder="e.g. +91 9876543210"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-[#f0f2f5] border-none rounded-[12px] focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] text-indigo-700 font-medium ml-1">Select Tags</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-[#f0f2f5] rounded-[12px] min-h-[50px]">
                      {globalTags.map(tag => {
                        const isSelected = (newContact.tags || []).includes(tag.name);
                        return (
                          <button
                            key={tag._id}
                            type="button"
                            onClick={() => {
                              let updatedTags;
                              if (isSelected) {
                                updatedTags = newContact.tags.filter(t => t !== tag.name);
                              } else {
                                updatedTags = [...(newContact.tags || []), tag.name];
                              }
                              setNewContact({ ...newContact, tags: updatedTags });
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20"
                              : "bg-white border-gray-200 text-slate-600 hover:border-indigo-400"
                              }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {globalTags.length === 0 && (
                        <p className="text-[11px] text-slate-400 italic">No tags defined in Settings</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[13px] text-slate-700 font-bold uppercase tracking-tight">Assign to Group</label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewContact(prev => ({ ...prev, groupId: prev.groupId === 'NEW_GROUP' ? '' : 'NEW_GROUP', newGroupName: '' }));
                            setShowGroupDropdown(false);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-all flex items-center gap-1"
                        >
                          {newContact.groupId === 'NEW_GROUP' ? '← Back to List' : '+ Create New Group'}
                        </button>
                      </div>

                      {newContact.groupId !== 'NEW_GROUP' ? (
                        <div className="relative">
                          {/* Custom Dropdown Trigger */}
                          <div
                            onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                            className="w-full px-4 py-3 bg-[#f0f2f5] border border-slate-100 rounded-[12px] flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all"
                          >
                            <span className="text-[15px] text-slate-700">
                              {newContact.groupId ? (groups.find(g => g._id === newContact.groupId)?.name || "Select Group") : "No Group (Individual)"}
                            </span>
                            <FiChevronDown className={`text-slate-400 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} />
                          </div>

                          {/* Dropdown List - Shows 4 items then scrolls */}
                          {showGroupDropdown && (
                            <>
                              <div className="fixed inset-0 z-[110]" onClick={() => setShowGroupDropdown(false)} />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-[12px] shadow-xl z-[120] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-1">
                                  <div
                                    onClick={() => {
                                      setNewContact({ ...newContact, groupId: "", newGroupName: "" });
                                      setShowGroupDropdown(false);
                                    }}
                                    className={`px-4 py-2.5 text-[14px] cursor-pointer rounded-lg mb-1 transition-colors ${!newContact.groupId ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    No Group (Individual)
                                  </div>
                                  {groups.map(g => (
                                    <div
                                      key={g._id}
                                      onClick={() => {
                                        setNewContact({ ...newContact, groupId: g._id, newGroupName: "" });
                                        setShowGroupDropdown(false);
                                      }}
                                      className={`px-4 py-2.5 text-[14px] cursor-pointer rounded-lg mb-1 transition-colors ${newContact.groupId === g._id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      {g.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                          <input
                            placeholder="Enter new group name"
                            value={newContact.newGroupName}
                            onChange={(e) => setNewContact({ ...newContact, newGroupName: e.target.value })}
                            className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-[12px] focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] transition-all font-medium text-indigo-900"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer - Fixed at bottom */}
                  <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                    <button
                      onClick={() => setShowAddContact(false)}
                      className="px-8 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-full text-[14px] transition-all cursor-pointer shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newContact.phone.trim()) {
                          alert("Please enter a phone number");
                          return;
                        }

                        try {
                          console.log('🔍 Adding contact:', newContact);
                          const res = await api.post("/contacts", {
                            name: newContact.name.trim() || "New Contact",
                            phone: newContact.phone.trim(),
                            tags: newContact.tags,
                            groupId: newContact.groupId === "NEW_GROUP" ? "" : newContact.groupId,
                            newGroupName: newContact.newGroupName,
                            source: "manual",
                          });

                          console.log('✅ Contact added response:', res.data);

                          if (res.data && res.data.contact) {
                            // ✅ Add to customers list
                            setCustomers((prev) => [res.data.contact, ...prev]);

                            // ✅ Set as active customer
                            setActiveCustomer(res.data.contact);

                            // ✅ Reset form and close modal IMMEDIATELY for better UX
                            setNewContact({ name: "", phone: "", tags: [], groupId: "", newGroupName: "" });
                            setShowAddContact(false);
                            setShowGroupDropdown(false);

                            // ✅ Refresh groups if a new one was created
                            if (newContact.newGroupName) fetchGroups();

                            // ✅ Load messages for new contact in background
                            await loadMessages(res.data.contact._id);

                            console.log('✅ Contact added successfully:', res.data.contact.name);
                          } else {
                            throw new Error('Invalid response from server');
                          }
                        } catch (error) {
                          console.error("❌ Error adding contact:", error);
                          if (error.response?.data?.error === "Phone already exists") {
                            alert("⚠️ Notice: This phone number is already added to your contacts.");
                          } else {
                            const errorMessage = error.response?.data?.error || error.message || "Failed to add contact";
                            alert(`Failed to add contact: ${errorMessage}`);
                          }
                        }
                      }}
                      className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full text-[14px] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Confirm & Start Chat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* ================= ADD MEMBERS MODAL ================= */}
      {
        showAddMembersModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl transition-all duration-500"
                onClick={() => setShowAddMembersModal(false)}
              />

              <div
                className="relative bg-white rounded-[12px] w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-[64px] px-6 flex items-center justify-between bg-indigo-600 text-white shrink-0 shadow-lg">
                  <h3 className="text-[17px] font-bold text-white heading-font">Add Members to {activeCustomer.name}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-xl">{selectedMembers.length} Selected</span>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-[12px] focus:ring-2 focus:ring-indigo-500 outline-none"
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[350px] max-h-[350px]">
                  {customers
                    .filter(c =>
                      !activeCustomer.contactIds?.includes(c._id) &&
                      (c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
                    )
                    .map(contact => (
                      <label
                        key={contact._id}
                        className={`flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-all border ${selectedMembers.includes(contact._id)
                          ? "bg-indigo-50 border-indigo-200 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                          : "hover:bg-gray-50 border-transparent"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedMembers.includes(contact._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers([...selectedMembers, contact._id]);
                            } else {
                              setSelectedMembers(selectedMembers.filter(id => id !== contact._id));
                            }
                          }}
                        />
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                          <img src={`https://ui-avatars.com/api/?name=${contact.name}&background=random&color=fff`} alt="" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-slate-900 truncate">{contact.name}</p>
                          <p className="text-[13px] text-slate-500 truncate">{contact.phone}</p>
                        </div>
                      </label>
                    ))}
                </div>

                <div className="p-6 bg-gray-50 flex justify-end gap-3 shrink-0">
                  <button
                    onClick={() => setShowAddMembersModal(false)}
                    className="px-6 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-semibold rounded-full text-[14px] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addMembersToGroup}
                    disabled={selectedMembers.length === 0}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full text-[14px] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Confirm {selectedMembers.length} Members
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* ================= TEMPLATE SELECTION MODAL - PREMIUM UI ================= */}
      {
        showTemplateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            {/* Professional backdrop with blur */}
            <div
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl transition-all duration-500"
              onClick={() => {
                setShowTemplateModal(false);
                setSelectedTemplateId("");
                setProcessedTemplate(null);
                setHeaderOverrideUrl("");
              }}
            />

            <div className="relative bg-[#f8fafc] rounded-[24px] w-full max-w-4xl h-[78vh] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300 border border-white/20">
              {/* Modal Header */}
              <div className="h-[70px] px-8 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <FiFileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-900 heading-font leading-tight">
                      {selectedTemplateId ? "Configure Template" : "Select WhatsApp Template"}
                    </h2>
                    <p className="text-[12px] text-slate-500 font-medium">
                      {selectedTemplateId ? "Fill variables to personalize your message" : "Choose a template to start a 24-hour conversation window"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedTemplateId && (
                    <button
                      onClick={() => {
                        setSelectedTemplateId("");
                        setProcessedTemplate(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-indigo-600 font-semibold text-[13px] transition-all hover:bg-indigo-50 rounded-xl"
                    >
                      <FiChevronLeft size={16} /> Back to Library
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setSelectedTemplateId("");
                      setProcessedTemplate(null);
                    }}
                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Main Content Area */}
                {!selectedTemplateId ? (
                  // STEP 1: GRID VIEW
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search & Filters Refined */}
                    <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
                      <div className="relative flex-1 group max-w-[300px]">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <FiSearch className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search..."
                          value={templateSearchTerm}
                          onChange={(e) => setTemplateSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-[14px] text-[13px] font-medium focus:bg-white focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-[14px] border border-slate-100/50 shrink-0">
                        {["All", "MARKETING", "UTILITY"].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setSelectedTemplateCategory(cat === "All" ? "All Categories" : cat)}
                            className={`px-4 py-1.5 rounded-[10px] text-[10px] font-black tracking-widest transition-all duration-300 uppercase ${(cat === "All" && selectedTemplateCategory === "All Categories") || selectedTemplateCategory === cat
                              ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                              : "text-slate-400 hover:text-slate-600"
                              }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Templates Grid - PREMIUM REFACTORED */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-[#f8fafc]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {templates
                          .filter(t => t.metaStatus === "approved")
                          .filter(t => selectedTemplateCategory === "All Categories" || t.category === selectedTemplateCategory)
                          .filter(t => t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) || (t.body || "").toLowerCase().includes(templateSearchTerm.toLowerCase()))
                          .map((t) => (
                            <div
                              key={t._id}
                              onClick={() => {
                                setSelectedTemplateId(t._id);
                                setTemplateParams({});
                                setHeaderOverrideUrl("");
                              }}
                              className="group bg-white border border-slate-100 rounded-[28px] p-7 hover:border-indigo-300 hover:shadow-[0_20px_40px_rgba(79,70,229,0.08)] transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col items-start"
                            >
                              {/* Category Accent */}
                              <div className={`absolute top-0 right-0 w-24 h-24 -mt-12 -mr-12 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${t.category === 'MARKETING' ? 'bg-purple-600' : 'bg-indigo-600'
                                }`} />

                              <div className="flex items-center gap-3 mb-5 shrink-0">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-[0.1em] uppercase ${t.category === 'MARKETING' ? 'bg-purple-50 text-purple-600' :
                                  t.category === 'UTILITY' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                  {t.category}
                                </div>
                                <div className="px-3 py-1 rounded-full bg-slate-50 text-slate-400 text-[10px] font-bold tracking-tight uppercase border border-slate-100">
                                  {t.language || 'en_US'}
                                </div>
                              </div>

                              <h3 className="text-[17px] font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors duration-300 line-clamp-1">
                                {t.name.replace(/_/g, ' ')}
                              </h3>

                              <div className="flex-1 w-full min-h-[80px]">
                                <p className="text-[13.5px] text-slate-500 line-clamp-3 leading-[1.6] mb-6 font-medium">
                                  {t.body}
                                </p>
                              </div>

                              <div className="w-full pt-5 border-t border-slate-50 flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter">Approved</span>
                                </div>
                                <div className="text-[13px] font-black text-indigo-600 flex items-center gap-1.5 transform group-hover:translate-x-1 transition-transform duration-300">
                                  Use Template
                                  <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <FiChevronRight size={14} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      {templates.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <FiAlertCircle className="text-slate-300" size={40} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">No templates found</h3>
                          <p className="text-slate-400 max-w-xs">Try adjusting your search or category filters to find approved templates.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // STEP 2: CONFIGURE VIEW
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#f8fafc]">
                    {/* ... (re-inserting the rest of the correctly refactored Step 2) */}
                    <div className="flex-1 overflow-y-auto p-4 lg:p-5 custom-scrollbar bg-white shadow-sm">
                      <div className="max-w-xl mx-auto space-y-4">
                        {/* Header Info */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                            <label className="text-[12px] font-black uppercase tracking-widest text-slate-400">Selected Blueprint</label>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-100 shadow-sm">
                            <h4 className="text-[17px] font-bold text-slate-800 font-poppins">{templates.find(t => t._id === selectedTemplateId)?.name}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">Meta Approved • Production Ready</p>
                          </div>
                        </div>

                        {/* 🔥 HEADER OVERRIDE SECTION */}
                        {templates.find(t => t._id === selectedTemplateId)?.header?.type === 'image' && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-5 bg-indigo-500 rounded-full" />
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Override Header Image</label>
                              </div>
                              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                  onClick={() => setHeaderOverrideTab('url')}
                                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase flex items-center gap-1.5 ${headerOverrideTab === 'url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                  <FiLink size={12} /> URL
                                </button>
                                <button
                                  onClick={() => setHeaderOverrideTab('upload')}
                                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase flex items-center gap-1.5 ${headerOverrideTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                  <FiUpload size={12} /> Upload
                                </button>
                              </div>
                            </div>

                            <div className="bg-slate-50/50 p-5 rounded-[22px] border border-slate-100 border-dashed">
                              {headerOverrideTab === 'url' ? (
                                <div className="space-y-3">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">PASTE IMAGE URL</p>
                                  <input
                                    type="text"
                                    value={headerOverrideUrl}
                                    onChange={(e) => setHeaderOverrideUrl(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[16px] text-[14px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase ml-1">CHOOSE FILE</p>
                                  {isUploadingHeader ? (
                                    <div className="h-14 flex items-center justify-center gap-2 bg-white rounded-[16px] border border-slate-200">
                                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                      <span className="text-[13px] font-bold text-slate-500">Uploading to cloud...</span>
                                    </div>
                                  ) : (
                                    <label className="h-14 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-[16px] cursor-pointer transition-all active:scale-[0.98] shadow-sm">
                                      <FiImage className="text-indigo-500" size={18} />
                                      <span className="text-[13px] font-bold text-slate-600">Select Image File</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files[0];
                                          if (!file) return;
                                          try {
                                            setIsUploadingHeader(true);
                                            const uploadedUrl = await uploadFile(file);
                                            setHeaderOverrideUrl(uploadedUrl);
                                          } catch (err) {
                                            console.error("Upload failed:", err);
                                            alert("Failed to upload image. Please try URL method.");
                                          } finally {
                                            setIsUploadingHeader(false);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              )}

                              {headerOverrideUrl && (
                                <div className="mt-4 flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <div className="flex items-center gap-2 truncate">
                                    <FiCheckCircle className="text-emerald-500 shrink-0" size={14} />
                                    <span className="text-[11px] font-bold text-emerald-700 truncate">{headerOverrideUrl}</span>
                                  </div>
                                  <button
                                    onClick={() => setHeaderOverrideUrl("")}
                                    className="text-[10px] font-black text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg uppercase transition-all"
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 🔥 CATALOG FEATURED PRODUCT (If Catalog Template) */}
                        {templates.find(t => t._id === selectedTemplateId)?.buttons?.some(b => b.type === 'CATALOG') && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-5 bg-indigo-500 rounded-full" />
                              <label className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Featured Product (Catalog Thumbnail)</label>
                            </div>
                            <div className="relative group">
                              <select
                                value={selectedProductSku}
                                onChange={(e) => setSelectedProductSku(e.target.value)}
                                className="w-full px-6 py-4 bg-indigo-50/30 border border-indigo-100 rounded-[20px] text-[15px] font-bold text-indigo-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                              >
                                <option value="">{inventoryProducts.length === 0 ? "No synced products found (check Meta Sync)" : "Select a product from your inventory..."}</option>
                                {inventoryProducts.map((prod) => (
                                  <option key={prod.sku} value={prod.sku}>
                                    {prod.name} (SKU: {prod.sku}) - ₹{(prod.price / 100).toFixed(2)}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500 transition-transform group-hover:scale-110">
                                <FiTag size={20} />
                              </div>
                            </div>
                            <p className="ml-1 text-[11px] text-indigo-600/70 font-medium italic flex items-center gap-2">
                              <FiInfo size={12} />
                              {inventoryProducts.length === 0
                                ? "⚠️ You need to sync products in the Commerce section first."
                                : "This product will show as the large cover image in the WhatsApp message."}
                            </p>
                          </div>
                        )}

                        {/* Parameters Grid */}
                        {processedTemplate && processedTemplate.manualVariables.length > 0 ? (
                          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between">
                              <h3 className="text-[15px] font-bold text-slate-800 font-poppins">Message Variables</h3>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleMagicFill}
                                  className="text-[10px] font-black tracking-widest text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-600/20 px-4 py-2 rounded-xl transition-all duration-300 uppercase shrink-0"
                                >
                                  Smart Auto Fill
                                </button>
                                <button
                                  onClick={() => setShowPasteModal(true)}
                                  className="text-[10px] font-black tracking-widest text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-600/20 px-4 py-2 rounded-xl transition-all duration-300 uppercase shrink-0"
                                >
                                  Bulk Paste
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                              {processedTemplate.manualVariables.map((variable, idx) => (
                                <div key={variable.variable} className="space-y-2.5 group">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">Variable {variable.variable}</span>
                                    {templateParams[variable.variable] && (
                                      <div className="flex items-center gap-1.5 text-indigo-600 animate-in zoom-in duration-300">
                                        <FiCheckCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Ready</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={templateParams[variable.variable] || ""}
                                      onChange={(e) => {
                                        const copy = { ...templateParams };
                                        copy[variable.variable] = e.target.value;
                                        setTemplateParams(copy);
                                      }}
                                      placeholder={`Type value for {{${variable.variable}}}...`}
                                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-[12px] text-[13.5px] font-medium text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-10 bg-indigo-50/50 rounded-[32px] border border-indigo-100/50 text-center animate-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md border border-indigo-50">
                              <FiCheckCircle className="text-indigo-600" size={32} />
                            </div>
                            <h4 className="text-[18px] font-bold text-indigo-900 mb-2">Static Response</h4>
                            <p className="text-[14px] text-indigo-600/70 max-w-xs mx-auto">This template contains no variables and is ready for immediate dispatch.</p>
                          </div>
                        )}

                        <div className="pt-6 border-t border-slate-50">
                          <button
                            onClick={sendTemplateMessage}
                            disabled={isUploading || (processedTemplate?.manualVariables.some(v => !templateParams[v.variable]))}
                            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-[18px] shadow-xl shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale cursor-pointer flex items-center justify-center gap-2.5 text-[15px] uppercase tracking-wider"
                          >
                            Send WhatsApp Template
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                              <FiSend size={15} />
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Live Preview (Right) - COMPACTED & SCROLLABLE */}
                    <div className="w-full md:w-[380px] bg-[#f0f2f5] border-l border-slate-200 p-6 flex flex-col shrink-0 relative overflow-y-auto custom-scrollbar">
                      <div className="whatsapp-chat-bg opacity-[0.05] absolute inset-0 pointer-events-none" />

                      <div className="relative z-10 flex flex-col h-full space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Real-time Preview</span>
                          </div>
                        </div>

                        <div className="flex-1 flex items-start justify-center pt-4">
                          {/* Authentic WhatsApp Bubble */}
                          <div className="w-full max-w-[340px] bg-white rounded-2xl rounded-tr-none p-4 shadow-xl border-l-[6px] border-indigo-500 relative overflow-hidden">
                            <div className="absolute top-0 right-[-10px] w-0 h-0 border-t-[10px] border-t-white border-r-[10px] border-r-transparent" />

                            {templates.find(t => t._id === selectedTemplateId)?.header?.type === 'image' && (
                              <div className="w-full h-[110px] rounded-xl overflow-hidden mb-3 bg-slate-100 shadow-inner">
                                <img
                                  src={headerOverrideUrl || templates.find(t => t._id === selectedTemplateId)?.header?.image}
                                  className="w-full h-full object-contain"
                                  alt="Header Preview"
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <p className="text-[13.5px] text-[#111b21] leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere] break-words">
                                {processedTemplate ? generatePreview(
                                  templates.find(t => t._id === selectedTemplateId)?.body || "",
                                  processedTemplate,
                                  templateParams
                                ) : (templates.find(t => t._id === selectedTemplateId)?.body || "")}
                              </p>
                              <div className="flex justify-end items-center gap-1.5 pt-1">
                                <span className="text-[9px] text-slate-400 font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <div className="flex text-slate-300">
                                  <FiCheck size={10} className="-mr-1" />
                                  <FiCheck size={10} />
                                </div>
                              </div>
                            </div>

                            {/* WhatsApp Template Buttons Preview - FIXED INSIDE THE BUBBLE FLOW */}
                            {(() => {
                              const selectedTemplate = templates.find(t => t._id === selectedTemplateId);
                              const buttons = selectedTemplate?.buttons || [];
                              if (buttons.length === 0) return null;

                              return (
                                <div className="mt-3 -mx-4 -mb-4 border-t border-indigo-500/10 flex flex-col divide-y divide-indigo-500/5 bg-slate-50/20">
                                  {buttons.map((btn, i) => (
                                    <div key={i} className="py-2 flex items-center justify-center gap-2 text-indigo-600 font-bold text-[12.5px] hover:bg-white/50 transition-colors">
                                      {btn.type === 'PHONE_NUMBER' && <FiPhone size={12} />}
                                      {btn.type === 'URL' && <FiExternalLink size={12} />}
                                      {btn.type === 'CATALOG' && <FiShoppingBag size={12} />}
                                      {btn.text}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Info Tip - COMPACTED */}
                      <div className="p-3 bg-white/60 backdrop-blur-sm rounded-[16px] border border-white shadow-sm mt-auto max-w-[280px] mx-auto">
                        <div className="flex gap-2 items-start text-center justify-center">
                          <FiInfo className="text-blue-600 mt-0.5" size={12} />
                          <p className="text-[10px] text-slate-500 leading-tight font-semibold">
                            Using a template re-opens the 24-hour service window.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
      {/* AUTO FILL MODAL - GLOBAL (Ensures it appears above all other modals) */}

      {
        showPasteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl transition-all duration-500" onClick={() => setShowPasteModal(false)} />
            <div className="relative bg-white w-[400px] rounded-[24px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    <FiFileText size={18} />
                  </div>
                  <span className="text-[14px] font-bold text-slate-800 font-poppins">Bulk Variable Paste</span>
                </div>
                <button onClick={() => setShowPasteModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><FiX size={18} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Input Content (one variable per line)</label>
                  <textarea
                    autoFocus
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                    placeholder={`Example:\nJohn Doe\nOrder #12345\nBlue Widget`}
                    className="w-full h-[180px] p-4 text-[14px] border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none resize-none bg-slate-50 font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group">
                    <input type="checkbox" checked={skipExtraLines} onChange={e => setSkipExtraLines(e.target.checked)} className="rounded-md border-slate-300 text-indigo-600 w-5 h-5 focus:ring-indigo-500/20" />
                    <span className="text-[13px] text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Skip Extra Lines</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group">
                    <input type="checkbox" checked={mergeRemaining} onChange={e => setMergeRemaining(e.target.checked)} className="rounded-md border-slate-300 text-indigo-600 w-5 h-5 focus:ring-indigo-500/20" />
                    <span className="text-[13px] text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Merge Extra Lines In Last Variable</span>
                  </label>
                </div>

                <button
                  onClick={applyBulkPaste}
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-[18px] text-[15px] shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Apply Variables <FiCheckCircle size={18} />
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 🔥 ADVANCED FILTER PANEL */}
      {showFilterPanel && createPortal(
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFilterPanel(false)} />
          <div className="relative w-full max-w-[380px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="h-[64px] px-6 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <FiFilter className="text-indigo-600" size={20} />
                <h2 className="text-lg font-bold text-slate-800 font-poppins">Advanced Filters</h2>
              </div>
              <button onClick={() => setShowFilterPanel(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiCalendar size={12} /> Date Filter
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: 'all', l: 'All Time' }, { id: 'today', l: 'Today' }, { id: 'yesterday', l: 'Yesterday' }, { id: 'last7', l: 'Last 7 Days' }, { id: 'last30', l: 'Last 30 Days' }].map(r => (
                    <button key={r.id} onClick={() => setFilters(p => ({ ...p, dateRange: r.id }))} className={`px-3 py-2 rounded-lg text-[12px] font-semibold transition-all border ${filters.dateRange === r.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                      {r.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiMessageSquare size={12} /> Reply Status
                </label>
                <select value={filters.replyStatus} onChange={(e) => setFilters(p => ({ ...p, replyStatus: e.target.value }))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none">
                  <option value="all">All Chats</option>
                  <option value="replied">Replied</option>
                  <option value="no_reply">No Reply (Pending)</option>
                  <option value="bot">Bot Replied</option>
                  <option value="human">Human Replied</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiClock size={12} /> Read Status
                </label>
                <div className="flex gap-2">
                  {['all', 'unread_only', 'read_only'].map(m => (
                    <button key={m} onClick={() => setFilters(p => ({ ...p, unread: m }))} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all border ${filters.unread === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {m === 'unread_only' ? 'Unread' : m === 'read_only' ? 'Read' : 'All'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiTag size={12} /> Filter by Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {globalTags.map(tag => {
                    const id = tag._id || tag;
                    const sel = filters.tags.includes(id);
                    return (
                      <button key={id} onClick={() => setFilters(p => ({ ...p, tags: sel ? p.tags.filter(t => t !== id) : [...p.tags, id] }))} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${sel ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {tag.name || tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. GROUP FILTER */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiUsers size={12} /> Filter by Group
                </label>
                <select value={filters.groupId || ''} onChange={(e) => setFilters(p => ({ ...p, groupId: e.target.value }))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none">
                  <option value="">All Groups</option>
                  {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>

              {/* 6. CAMPAIGN FILTER */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiSend size={12} /> Campaign Filter
                </label>
                <div className="space-y-2">
                  <select value={filters.campaignId} onChange={(e) => setFilters(p => ({ ...p, campaignId: e.target.value }))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none">
                    <option value="">Select Campaign</option>
                    {campaignList.length > 0 ? (
                      campaignList.map(c => <option key={c._id} value={c._id}>{c.name}</option>)
                    ) : (
                      <option disabled>No Campaigns Found</option>
                    )}
                  </select>
                  <select value={filters.campaignReply} onChange={(e) => setFilters(p => ({ ...p, campaignReply: e.target.value }))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none">
                    <option value="">All Campaign Users</option>
                    <option value="true">Replied Users</option>
                    <option value="false">Not Replied</option>
                  </select>
                </div>
              </div>

              {/* Removed Assigned Agent Filter as requested */}

              {/* 8. FLOW STATUS */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiActivity size={12} /> Flow Status
                </label>
                <select value={filters.flowStatus} onChange={(e) => setFilters(p => ({ ...p, flowStatus: e.target.value }))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none">
                  <option value="">All Status</option>
                  <option value="active">In Active Flow</option>
                  <option value="completed">Completed Flow</option>
                  <option value="none">No Flow</option>
                </select>
              </div>

              {/* 9. CONTACT TYPE */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <FiBriefcase size={12} /> Contact Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['all', 'new', 'returning', 'imported', 'manual'].map(type => (
                    <button key={type} onClick={() => setFilters(p => ({ ...p, contactType: type }))} className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${filters.contactType === type ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 10. MESSAGE TYPE */}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-[1001]">
              <button onClick={() => setFilters({ dateRange: 'all', replyStatus: 'all', unread: 'all', campaignId: '', campaignReply: '', assignedTo: '', flowStatus: '', messageType: '', contactType: '', tags: [] })} className="flex-1 py-3 text-[14px] font-bold text-slate-500 hover:text-red-500">Reset All</button>
              <button onClick={() => setShowFilterPanel(false)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[14px] font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Show {totalContacts} Chats</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= SEND FLOW MODAL ================= */}
      {showFlowModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-500 overflow-hidden">
          <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 p-6 w-full max-w-[500px] animate-in fade-in zoom-in duration-300 relative">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100/80 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center shadow-sm shadow-indigo-100/20 border border-indigo-100/50">
                  <FiLayers className="text-indigo-600" size={22} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-slate-900 tracking-tight font-outfit">Deploy Automation Flow</h3>
                  <p className="text-[12px] text-slate-500 font-medium font-inter mt-0.5">Select a predefined sequence to send to {activeCustomer?.name}</p>
                </div>
              </div>
              <button onClick={() => setShowFlowModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-200/60">
                <FiX size={16} />
              </button>
            </div>

            <div className="max-h-[450px] overflow-y-auto custom-scrollbar space-y-3 pr-2">
              {publishedFlows.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-[13px] font-bold text-slate-600">No published flows found</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">Create and publish an automation flow in the Flow Builder to see it here.</p>
                </div>
              ) : (
                publishedFlows.map(flow => {
                  const isSelected = sendingFlowId === `select_${flow._id}`;
                  return (
                    <div key={flow._id} className={`rounded-2xl border ${isSelected ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-200/60 bg-white hover:border-indigo-300'} transition-all overflow-hidden`}>
                      {/* Header Row */}
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => setSendingFlowId(isSelected ? null : `select_${flow._id}`)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl ${isSelected ? 'bg-indigo-600' : 'bg-slate-50 border border-slate-100'} flex items-center justify-center shrink-0 transition-colors`}>
                            <FiCheckCircle className={`${isSelected ? 'text-white' : 'text-slate-400'} w-5 h-5 transition-colors`} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[14px] font-bold text-slate-800 tracking-tight font-inter">{flow.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-black uppercase tracking-widest border border-emerald-100">
                                Active
                              </span>
                              {flow.categories && flow.categories.length > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium italic">
                                  {flow.categories.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-slate-400">
                          {isSelected ? <FiChevronRight className="rotate-90 transition-transform" /> : <FiChevronRight className="transition-transform" />}
                        </div>
                      </div>

                      {/* Expanded Details Panel */}
                      {isSelected && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <FiLayers className="text-indigo-500" />
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">WhatsApp Native Form</span>
                            </div>
                            <p className="text-[13px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                              Please fill out this form to continue.
                            </p>
                            <div className="mt-3 py-2 text-center bg-indigo-50 text-indigo-600 text-[12px] font-bold rounded-lg border border-indigo-100">
                              Open Form
                            </div>
                          </div>

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!activeCustomer) return;
                              setSendingFlowId(flow._id); // Actual sending state
                              try {
                                const res = await api.post('/whatsapp-flows/send', {
                                  flowId: flow._id,
                                  to: activeCustomer.phone,
                                  customerName: activeCustomer.name
                                });
                                if (res.data.success) {
                                  if (res.data.msg) {
                                    setMessages((prev) => [...prev, res.data.msg]);
                                  }
                                  setShowFlowModal(false);
                                  setTimeout(() => {
                                    if (typeof fetchCustomers === 'function') fetchCustomers();
                                    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                                  }, 100);
                                }
                              } catch (err) {
                                alert(err.response?.data?.message || "Failed to send flow");
                                setSendingFlowId(`select_${flow._id}`); // Reset back to selected
                              }
                            }}
                            disabled={sendingFlowId === flow._id}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-70"
                          >
                            {sendingFlowId === flow._id ? "Sending..." : "Send WhatsApp Flow"} <FiSend size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>

  );
}
