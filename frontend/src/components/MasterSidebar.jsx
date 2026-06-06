import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/useAuth";
import {
    LayoutDashboard,
    Users,
    Link as LinkIcon,
    Activity,
    LogOut,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Shield,
    FileText,
    Zap,
    Globe,
    Database,
    ShieldCheck
} from "lucide-react";

export default function MasterSidebar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [userManagementExpanded, setUserManagementExpanded] = useState(true);

    const menu = [
        { label: "Dashboard", path: "/master/dashboard", icon: LayoutDashboard },
        { label: "User Management", path: "/master/users", icon: Users },
        { label: "Global Integrations", path: "/master/integrations", icon: LinkIcon },
        { label: "Subscription Plans", path: "/master/plans", icon: Zap },
        { label: "Webhook Logs", path: "/master/webhooks", icon: Activity },
        { label: "System Logs", path: "/master/system-logs", icon: Database },
    ];

    return (
        <aside
            className={`h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300
      ${collapsed ? "w-[72px]" : "w-64"}
      overflow-hidden z-50`}
        >
            {/* LOGO */}
            <div className="h-16 shrink-0 flex items-center px-4 relative border-b border-slate-800 bg-slate-900">
                <div className={`flex items-center transition-all duration-300 ease-in-out ${collapsed ? "justify-center w-full" : "gap-3"}`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shrink-0">
                        <span className="text-lg font-bold text-white tracking-tight leading-none">Z</span>
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col">
                            <span className="text-white font-bold tracking-tight text-[16px] leading-none">Zepofy</span>
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">MASTER ADMIN</span>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`absolute top-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 ${collapsed ? "right-1/2 translate-x-1/2" : "right-3"}`}
                >
                    <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
                </button>
            </div>

            {/* MENU */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                {menu.map((item) => {
                    const hasChildren = item.children && item.children.length > 0;
                    const isActive = location.pathname === item.path;
                    const isParentActive = hasChildren && item.children.some(child => location.pathname === child.path);
                    const Icon = item.icon;

                    if (hasChildren) {
                        return (
                            <div key={item.label}>
                                <button
                                    onClick={() => setUserManagementExpanded(!userManagementExpanded)}
                                    className={`w-full group flex items-center rounded-[12px] transition-all duration-200
                                        ${collapsed ? "justify-center px-3 py-3" : "gap-3 px-3 py-2.5"}
                                        ${isParentActive ? "bg-indigo-50 text-indigo-600 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"}
                                    `}
                                >
                                    <Icon className={`w-5 h-5 shrink-0 ${isParentActive ? "text-indigo-600" : "text-slate-400"}`} />
                                    {!collapsed && (
                                        <>
                                            <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                                            {userManagementExpanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                                        </>
                                    )}
                                </button>

                                {!collapsed && userManagementExpanded && (
                                    <div className="ml-4 mt-1 space-y-1 pl-4 border-l border-slate-200">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.label}
                                                to={child.path}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                                                    ${isActive ? "text-indigo-600 font-bold bg-indigo-50/50" : "text-slate-500 hover:text-indigo-600"}`
                                                }
                                            >
                                                <span>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className={({ isActive }) =>
                                `group relative flex items-center rounded-lg transition-all duration-200
                                ${collapsed ? "justify-center px-4 py-3" : "gap-3 px-3 py-2.5"}
                                ${isActive ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white font-medium shadow-md" : "text-slate-400 font-medium hover:bg-slate-800 hover:text-white"}
                                `
                            }
                        >
                            <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                            {!collapsed && <span className="text-sm truncate">{item.label}</span>}
                            {collapsed && (
                                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[100] whitespace-nowrap">
                                    {item.label}
                                </div>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* FOOTER */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                <div className={`flex items-center rounded-[12px] p-2 bg-slate-800 border border-slate-700 transition-all ${collapsed ? "justify-center" : "gap-3"}`}>
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center border border-indigo-500 shrink-0">
                        <span className="text-white font-bold text-xs">{user?.name?.[0]?.toUpperCase() || "A"}</span>
                    </div>
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate uppercase tracking-tight">{user?.name}</div>
                            <div className="text-[10px] text-slate-400 truncate font-mono font-bold">MASTER</div>
                        </div>
                    )}
                    {!collapsed && (
                        <button
                            onClick={logout}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
