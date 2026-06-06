import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import {
  Home,
  Send,
  MessageSquare,
  Users,
  Zap,
  User,
  Settings,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Link as LinkIcon,
  Mail,
  LogOut,
  LayoutDashboard,
  FileText,
  ShoppingCart,
  GitBranch,
  Plus,
  CreditCard,
  Calendar,
  Bot,
  RefreshCw,
} from "lucide-react";
import { useIntegration } from "../context/IntegrationContext";
import { FEATURES } from "../config/features";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const { whatsappConnected, catalogConnected, wooConnected, shopifyConnected, facebookInstagramConnected, loading } = useIntegration();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);

  // Handle Tablet behavior: Auto-collapse if on tablet screen
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1200) {
        setCollapsed(true);
      } else if (window.innerWidth >= 1200) {
        setCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  }, [location.pathname, setIsOpen]);

  // Auto-expand folder if active child
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/campaigns')) setExpandedMenu("Campaigns");
    else if (path.startsWith('/email-management')) setExpandedMenu("Email Management");
    else if (path === '/templates' || path === '/email-templates') setExpandedMenu("Templates");
    else if (path === '/contacts' || path === '/groups') setExpandedMenu("Contacts");
    else if (path.startsWith('/settings')) setExpandedMenu("Settings");
    else if (path.startsWith('/woocommerce') || path.startsWith('/abandoned-carts')) setExpandedMenu("WooCommerce");
    else if (path.startsWith('/shopify')) setExpandedMenu("Shopify");
  }, [location.pathname]);

  const menuGroups = [
    {
      title: "GENERAL",
      items: [
        ...(user?.permissions?.dashboard !== false ? [{ label: "Dashboard", path: "/", icon: LayoutDashboard }] : []),
        { label: "WhatsApp Inbox", path: "/messages", icon: MessageSquare },
        ...(facebookInstagramConnected ? [{ label: "Social Inbox", path: "/social-inbox", icon: MessageCircle }] : []),
        ...(user?.permissions?.templates !== false ? [{
          label: "Templates",
          icon: FileText,
          children: [
            { label: "WhatsApp Templates", path: "/templates", icon: Send },
            { label: "System Templates", path: "/templates/system", icon: FileText }
          ]
        }] : []),
        ...(user?.permissions?.contacts !== false ? [{
          label: "Contacts",
          icon: Users,
          children: [
            { label: "All Contacts", path: "/contacts", icon: User },
            { label: "Contact Groups", path: "/groups", icon: Users }
          ]
        }] : []),
        ...(user?.permissions?.campaigns !== false ? [{
          label: "Campaigns",
          icon: Zap,
          children: [
            { label: "WhatsApp Campaigns", path: "/campaigns/whatsapp", icon: Send }
          ]
        }] : []),
        ...(user?.permissions?.appointments !== false ? [{ label: "Appointments", path: "/appointments", icon: Calendar }] : []),
      ]
    },
    {
      title: "AUTOMATION",
      items: [
        ...(user?.permissions?.automation !== false && FEATURES.FLOW_BUILDER ? [{
          label: "Flow Builder",
          path: "/automation/flows",
          icon: GitBranch
        }] : []),
        ...(user?.permissions?.whatsappFlows !== false ? [{
          label: "WhatsApp Flows",
          path: "/automation/whatsapp-flows",
          icon: Bot
        }] : []),
      ]
    },
    {
      title: "STORE",
      items: [
        ...(wooConnected ? [{
          label: "WooCommerce",
          icon: ShoppingCart,
          children: [
            { label: "Orders Data", path: "/woocommerce/orders", icon: ShoppingCart },
            { label: "Abandoned Carts", path: "/abandoned-carts", icon: ShoppingCart },
            { label: "Workflow Automations", path: "/woocommerce/automations", icon: Zap },
            { label: "Repeat Purchase Automation", path: "/woocommerce/repeat-purchase", icon: RefreshCw }
          ]
        }] : []),
        ...(shopifyConnected ? [{
          label: "Shopify",
          icon: ShoppingCart,
          children: [
            { label: "Orders Data", path: "/shopify/orders", icon: ShoppingCart },
            { label: "Abandoned Carts", path: "/shopify/checkouts", icon: ShoppingCart }
          ]
        }] : []),
        ...(catalogConnected ? [{
          label: "WhatsApp Store",
          icon: ShoppingCart,
          children: [
            { label: "Products", path: "/commerce/products", icon: ShoppingCart },
            { label: "Categories", path: "/commerce/categories", icon: GitBranch },
            { label: "Catalog Sync", path: "/commerce/catalog-sync", icon: Zap },
            { label: "Orders", path: "/commerce/orders", icon: CreditCard }
          ]
        }] : [])
      ]
    },
    {
      title: "SETTING",
      items: [
        ...(user?.permissions?.settings !== false ? [{
          label: "Settings",
          icon: Settings,
          children: [
            { label: "Integrations", path: "/settings", icon: LinkIcon },
            { label: "Tags", path: "/settings/tags", icon: GitBranch }
          ]
        }] : []),
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
      />

      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 64 : 256,
          x: isOpen || window.innerWidth >= 1024 ? 0 : -256
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 lg:static h-screen bg-white border-r border-slate-100 z-[100] lg:z-[40] flex flex-col overflow-hidden shadow-xl lg:shadow-none"
      >
        {/* LOGO */}
        <div className="h-16 shrink-0 flex items-center justify-between px-5 bg-white border-b border-slate-100 relative">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 bg-shine rounded-xl flex items-center justify-center shadow-shine ring-1 ring-white/10">
                  <Zap className="w-5 h-5 text-white fill-current" />
                </div>
                <span className="text-xl font-semibold text-slate-800 tracking-tight font-outfit">
                  Zepo<span className="text-indigo-600">fy</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all duration-200 ${collapsed ? "mx-auto" : ""}`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* MENU */}
        <nav className={`flex-1 ${collapsed ? "px-1.5" : "px-3"} py-4 space-y-6 overflow-y-auto custom-scrollbar scrollbar-hide`}>
          {menuGroups.map((group) => group.items.length > 0 && (
            <div key={group.title} className="space-y-1">
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 opacity-100 transition-opacity whitespace-nowrap"
                  >
                    {group.title}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isParentActive = hasChildren && item.children.some(child => {
                    if (child.path === '/') return location.pathname === '/';
                    return location.pathname.startsWith(child.path);
                  });
                  const isActive = !hasChildren && (
                    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
                  );
                  const Icon = item.icon;

                  if (hasChildren) {
                    const isExpanded = expandedMenu === item.label;
                    const handleParentClick = () => {
                      setExpandedMenu(isExpanded ? null : item.label);
                    };

                    return (
                      <div key={item.label} className="space-y-1">
                        <button
                          onClick={handleParentClick}
                          className={`w-full group flex items-center transition-all duration-300 font-medium text-[14px] relative
                          ${collapsed ? "justify-center p-3 rounded-xl" : "gap-3.5 px-4 py-3 rounded-xl"}
                          ${isParentActive
                              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                              : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"}
                        `}
                        >
                          <Icon className={`w-5 h-5 shrink-0 transition-all duration-300 ${isParentActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600 group-hover:scale-110"}`} />
                          <AnimatePresence mode="wait">
                            {!collapsed && (
                              <motion.div
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -5 }}
                                className="flex-1 flex items-center gap-2 overflow-hidden"
                              >
                                <span className="flex-1 text-left truncate font-inter tracking-tight">{item.label}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 opacity-60 ${isExpanded ? "rotate-180" : ""}`} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>

                        <AnimatePresence>
                          {(!collapsed && isExpanded) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                              className="ml-7 pl-4 border-l border-blue-100/50 space-y-1 mt-1.5 font-poppins overflow-hidden"
                            >
                              {item.children?.map((child) => (
                                <NavLink
                                  key={child.label}
                                  to={child.path}
                                  end={child.path === "/templates" || child.path === "/contacts" || child.path === "/settings"}
                                  className={({ isActive }) =>
                                    `block px-3 py-2 text-[13px] rounded-lg transition-all duration-300 border-l-2 truncate whitespace-nowrap
                                  ${isActive
                                      ? "text-indigo-700 bg-indigo-50/50 border-indigo-600 shadow-sm font-semibold"
                                      : "text-slate-500 hover:text-indigo-600 hover:bg-slate-50 border-transparent font-medium"}
                                `
                                  }
                                >
                                  {child.label}
                                </NavLink>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      className={({ isActive }) =>
                        `group flex items-center transition-all duration-300 font-medium text-[14px] relative
                        ${collapsed ? "justify-center p-3 rounded-xl" : "gap-3.5 px-4 py-3 rounded-xl"}
                        ${isActive
                          ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"}
                      `
                      }
                    >
                      <Icon className={`w-5 h-5 shrink-0 transition-all duration-300 ${location.pathname === item.path ? "text-white" : "text-slate-400 group-hover:text-indigo-600 group-hover:scale-110"}`} />
                      <AnimatePresence mode="wait">
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            className="flex-1 text-left truncate font-inter tracking-tight"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>


        {/* User Profile */}
        <div className={`border-t border-slate-100 mt-auto ${collapsed ? "p-2" : "p-4"}`}>
          <motion.div
            layout
            className={`flex items-center transition-all duration-300 ${collapsed ? "justify-center bg-transparent border-none shadow-none" : "gap-3 p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md group cursor-pointer"}`}
          >
            <motion.div
              layout
              className={`rounded-full overflow-hidden shrink-0 ring-1 ring-slate-200 transition-all duration-300 ${collapsed ? "w-9 h-9" : "w-10 h-10"}`}
            >
              {user?.photo ? (
                <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
            </motion.div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center flex-1 min-w-0 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate font-inter leading-tight">{user?.name || "Admin"}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{user?.role || "ADMIN"}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.aside>
    </>
  );
}