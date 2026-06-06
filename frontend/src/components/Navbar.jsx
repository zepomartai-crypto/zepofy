import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getImageUrl } from "../utils/imageHelpers";
import {
  Settings,
  LogOut,
  User,
  ChevronDown,
  Bell,
  Menu,
  Search,
  Zap,
  RotateCw,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../utils/cn";
import api from "../api/api";

// ✅ Global Socket.IO instance - Strictly Singleton to prevent duplicate connections
let socketInstance = null;

export default function Navbar({ onToggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ Auto-refresh user data on mount to catch plan updates
  useEffect(() => {
    if (user?._id) refreshUser();
  }, []);

  // ✅ Initialize Socket.IO connection
  useEffect(() => {
    if (!user?._id) return;

    // 1. Initial Unread Count
    const fetchUnread = async () => {
      try {
        const res = await api.get("/inbox/notifications/unread-count");
        setUnreadCount(res.data.count || 0);
      } catch (err) { console.error("Failed to fetch unread count", err); }
    };
    fetchUnread();

    // 2. Browser Notifications Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 3. Socket Setup
    if (!socketInstance) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

      socketInstance = io(serverUrl, {
        auth: { token: localStorage.getItem('token') },
        reconnection: true,
        transports: ['websocket', 'polling']
      });

      window.zepofySocket = socketInstance;

      socketInstance.on('connect', () => {
        if (user?._id) socketInstance.emit('user_connect', user._id);
      });

      socketInstance.on('new_message', (data) => {
        console.log('🔔 New message received:', data);
        // Only increment if it's an incoming message from a customer
        if (data.direction === "incoming") {
          fetchUnread();
        }

        // Browser Notification
        if (data.direction === "incoming" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const notification = new Notification(`New Message from ${data.senderName || 'Customer'}`, {
            body: data.text || data.body || "New media received",
            icon: '/logo.png'
          });
          notification.onclick = () => {
            window.focus();
            navigate("/messages");
          };
        }
      });

      socketInstance.on('messages_read', () => {
        fetchUnread();
      });

      socketInstance.on('notifications_cleared', () => {
        setUnreadCount(0);
      });
    } else {
      if (socketInstance.connected) socketInstance.emit('user_connect', user._id);
    }
  }, [user?._id]);

  // ✅ Enhanced page titles with comprehensive route mapping
  const getPageTitle = (pathname) => {
    console.log('🔍 Current pathname:', pathname); // Debug log

    // Exact match for root/dashboard
    if (pathname === "/" || pathname === "/dashboard") return "Dashboard Overview";

    // Standalone WooCommerce routes (sometimes prefix is omitted)
    if (pathname === "/abandoned-carts" || pathname.startsWith("/abandoned-carts/")) return "Abandoned Carts";
    if (pathname === "/orders" || pathname.startsWith("/orders/")) return "Orders Data";
    if (pathname === "/checkouts" || pathname.startsWith("/checkouts/")) return "Abandoned Checkouts";

    // Handle template routes specifically
    if (pathname === "/email-templates" || pathname === "/email-templates/") return "Email Templates";
    if (pathname === "/whatsapp-templates" || pathname === "/whatsapp-templates/") return "WhatsApp Templates";
    if (pathname.startsWith("/email-templates")) return "Email Templates";
    if (pathname.startsWith("/whatsapp-templates")) return "WhatsApp Templates";

    // Handle template library routes
    if (pathname.includes("/templates/system")) return "System Templates";
    if (pathname.startsWith("/templates")) return "WhatsApp Templates";

    // Main App Sections
    if (pathname.startsWith("/messages")) return "Messages";
    if (pathname.startsWith("/contacts")) return "Contacts";
    if (pathname.startsWith("/groups")) return "Contact Groups";

    // Campaign Management
    if (pathname.startsWith("/campaigns")) {
      if (pathname.includes("/whatsapp")) return "WhatsApp Campaigns";
      if (pathname.includes("/email")) return "Email Campaigns";
      return "Campaigns";
    }

    // Email Management
    if (pathname.startsWith("/email-management")) {
      if (pathname === "/email-management" || pathname === "/email-management/") return "Email Recipients";
      if (pathname.startsWith("/email-management/groups")) return "Email Groups";
      return "Email Management";
    }

    // Integrations
    if (pathname.startsWith("/integrations")) {
      if (pathname.includes("/whatsapp")) return "WhatsApp Integration";
      if (pathname.includes("/email")) return "Email Integration";
      return "Integrations";
    }

    // Profile and settings
    if (pathname.startsWith("/profile")) return "Profile Settings";
    if (pathname.startsWith("/settings")) return "Settings";

    // Shopify Routes
    if (pathname.startsWith("/shopify")) {
      if (pathname.includes("/orders")) return "Shopify Orders";
      if (pathname.includes("/checkouts")) return "Abandoned Checkouts";
      return "Shopify Integration";
    }

    // Master Routes
    if (pathname.startsWith("/master/dashboard")) return "System Metrics";
    if (pathname.startsWith("/master/users")) return "User Directory";
    if (pathname.startsWith("/master/integrations")) return "Global Integrations";
    if (pathname.startsWith("/master/webhooks")) return "Webhook Monitoring";
    if (pathname.startsWith("/master/system-logs")) return "System Logs";
    if (pathname.startsWith("/master/profile")) return "Master Profile";

    // Automation
    if (pathname.startsWith("/automation/flows") || pathname.startsWith("/flow-builder")) return "Flow Builder";

    // WhatsApp Flows
    if (pathname.startsWith("/automation/whatsapp-flows")) {
      if (pathname === "/automation/whatsapp-flows" || pathname === "/automation/whatsapp-flows/") return "WhatsApp Flows";
      return "WhatsApp Flow Builder";
    }

    // WooCommerce Prefixed Routes
    if (pathname.startsWith("/woocommerce")) {
      if (pathname.includes("/orders")) return "Orders Data";
      if (pathname.includes("/abandoned-carts")) return "Abandoned Carts";
      if (pathname.includes("/checkouts")) return "Abandoned Checkouts";
      return "WooCommerce Integration";
    }

    // Appointments
    if (pathname.startsWith("/appointments")) return "Appointment Management";

    // Fallback for any other routes
    console.log('⚠️ No specific title found for:', pathname, 'using fallback');
    return "Dashboard Overview";
  };

  const title = getPageTitle(location.pathname);
  const profileImage = user?.photo || null;

  const daysRemaining = user?.accountExpiry
    ? Math.max(0, Math.ceil((new Date(user.accountExpiry) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
  };

  return (
    <header className="h-16 bg-white border-b border-[#E0F2FE] flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 sticky top-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-md transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight font-poppins leading-none">
            {title}
          </h1>
          {location.pathname === "/" ? (
            <p className="hidden sm:block text-[11px] text-slate-500 font-medium mt-1 font-poppins">
              Welcome back! Here's your performance overview.
            </p>
          ) : location.pathname === "/appointments" ? (
            <p className="hidden sm:block text-[11px] text-slate-500 font-medium mt-1 font-poppins">
              View and manage patient bookings from WhatsApp
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Subscription Badge for Users */}
        {user?.role === 'user' && (
          <div className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500",
            daysRemaining <= 7
              ? "bg-rose-50 border-rose-200 animate-pulse"
              : "bg-indigo-50 border-indigo-100"
          )}>
            <Zap size={14} className={cn(
              daysRemaining <= 7 ? "text-rose-600 fill-rose-600" : "text-indigo-600 fill-indigo-600"
            )} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider",
              daysRemaining <= 7 ? "text-rose-700" : "text-indigo-700"
            )}>
              {user.plan || 'Free Plan'} • {daysRemaining} Days Left
            </span>
          </div>
        )}

        {/* Notifications - Hidden for Superadmin */}
        {user?.role !== 'superadmin' && (
          <button
            onClick={() => navigate("/messages")}
            className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full group"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] flex items-center justify-center px-1 rounded-full border-2 border-white shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm hover:ring-2 hover:ring-blue-100 transition-all flex items-center justify-center bg-slate-100"
          >
            {profileImage ? (
              <img src={getImageUrl(profileImage)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </button>

          {/* User Menu Dropdown */}
          <AnimatePresence>
            {showProfileMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10, x: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10, x: 10 }}
                  className="absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
                >
                  {/* User Profile Header */}
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl shrink-0">
                        {profileImage ? (
                          <img src={getImageUrl(profileImage)} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          user?.name?.[0]?.toUpperCase() || "U"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate font-poppins text-base leading-none mb-1">
                          {user?.name || user?.fullName || "User Account"}
                        </p>
                        <p className="text-[12px] text-slate-500 truncate leading-none">
                          {user?.email || "No email provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        const profilePath = user?.role === 'superadmin' ? "/master/profile" : "/profile";
                        navigate(profilePath);
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-sm text-slate-700 rounded-xl transition-all group"
                    >
                      <User className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                      <span className="font-bold">Profile Settings</span>
                    </button>

                    {user?.role !== 'superadmin' && (
                      <button
                        onClick={() => { navigate("/settings"); setShowProfileMenu(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-sm text-slate-700 rounded-xl transition-all group"
                      >
                        <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        <span className="font-bold">Settings</span>
                      </button>
                    )}

                    <div className="h-px bg-slate-100 my-1.5" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 text-sm text-rose-600 rounded-xl transition-all group"
                    >
                      <LogOut className="w-4 h-4 text-rose-400 group-hover:text-rose-600" />
                      <span className="font-bold">Logout</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
