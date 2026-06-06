// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useIntegration } from "../context/IntegrationContext";

import MainLayout from "../layouts/MainLayout";
import PrivateRoute from "./PrivateRoute";
import { FEATURES } from "../config/features";
import Dashboard from "../pages/Dashboard";
import Templates from "../pages/Templates";
import SystemTemplates from "../pages/SystemTemplates";
import Messages from "../pages/Messages";
import SocialInbox from "../pages/social/SocialInbox";
import Contacts from "../pages/Contacts";
import Campaigns from "../pages/Campaigns";
import FlowBuilder from "../pages/automation/FlowBuilder";
import AutomationFlows from "../pages/automation/FlowList";
import WhatsAppFlowsList from "../pages/whatsappFlows/WhatsAppFlowsList";
import WhatsAppFlowBuilder from "../pages/whatsappFlows/WhatsAppFlowBuilder";
import WhatsAppFlowPreview from "../pages/whatsappFlows/WhatsAppFlowPreview";
import WhatsAppFlowAnalytics from "../pages/whatsappFlows/WhatsAppFlowAnalytics";
import WhatsAppFlowTemplates from "../pages/whatsappFlows/WhatsAppFlowTemplates";
import Profile from "../pages/Profile";
import Settings from "../pages/Settings";
import Login from "../pages/Login";
import Register from "../pages/Register";
// import AllFlows from "../pages/AllFlows";
import Groups from "../pages/Groups"; // 
import WooCommerceOrders from "../pages/WooCommerceOrders";
import WooCommerceAutomations from "../pages/WooCommerceAutomations";
import WooCommerceRepeatPurchase from "../pages/WooCommerceRepeatPurchase";
import OrderDetail from "../pages/OrderDetail";
import AbandonedCarts from "../pages/AbandonedCarts";
import AbandonedCartDetail from "../pages/AbandonedCartDetail";
import CampaignDetail from "../pages/CampaignDetail";
import Tags from "../pages/Tags";
import Appointments from "../pages/Appointments";

// Campaign Pages
// ...removed email imports...




// Super Admin Pages
import MasterLayout from "../layouts/MasterLayout";
import MasterDashboard from "../pages/master/MasterDashboard";
import UserManagement from "../pages/master/UserManagement";
import WebhookLogs from "../pages/master/WebhookLogs";
import SystemLogs from "../pages/master/SystemLogs";
import GlobalIntegrations from "../pages/master/GlobalIntegrations";
import MasterPlans from "../pages/master/MasterPlans";
import MasterProfile from "../pages/master/MasterProfile";

// Shopify Pages
import ShopifyOrders from "../pages/shopify/ShopifyOrders";
import ShopifyAbandoned from "../pages/shopify/ShopifyAbandoned";
import ShopifyOrderDetail from "../pages/shopify/ShopifyOrderDetail";
import ShopifyCheckoutDetail from "../pages/shopify/ShopifyCheckoutDetail";
import WhatsAppGuard from "../components/auth/WhatsAppGuard";
import SubscriptionGuard from "../components/auth/SubscriptionGuard";
import PermissionGuard from "../components/auth/PermissionGuard";

// Commerce Pages
import CommerceDashboard from "../pages/commerce/CommerceDashboard";
import Products from "../pages/commerce/Products";
import Categories from "../pages/commerce/Categories";
import CatalogSync from "../pages/commerce/CatalogSync";
import Orders from "../pages/commerce/Orders";
import CommerceOrderDetail from "../pages/commerce/OrderDetail";

const StoreGuard = ({ children, store }) => {
  const { wooConnected, shopifyConnected, loading } = useIntegration();
  if (loading) return <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-400 text-sm font-semibold uppercase tracking-widest animate-pulse">Checking connection...</p></div>;
  if (store === 'woocommerce' && !wooConnected) return <Navigate to="/settings?tab=woocommerce" replace />;
  if (store === 'shopify' && !shopifyConnected) return <Navigate to="/settings?tab=shopify" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const { wooConnected, shopifyConnected, loading } = useIntegration();

  // We don't want to block the whole app while integrations load
  // but we can pass the state down if needed.
  // if (loading) return null;

  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* SUPER ADMIN (MASTER) ROUTES */}
      <Route
        path="/master"
        element={
          <PrivateRoute>
            {user?.role === "superadmin" ? <MasterLayout key={user?._id} /> : <Navigate to="/" replace />}
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/master/dashboard" replace />} />
        <Route path="dashboard" element={<MasterDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="integrations" element={<GlobalIntegrations />} />
        <Route path="plans" element={<MasterPlans />} />
        <Route path="webhooks" element={<WebhookLogs />} />
        <Route path="system-logs" element={<SystemLogs />} />
        <Route path="profile" element={<MasterProfile />} />
      </Route>

      {/* USER ROUTES */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            {user?.role === "superadmin" ? (
              <Navigate to="/master/dashboard" replace />
            ) : (
              <SubscriptionGuard>
                <MainLayout key={user?._id} />
              </SubscriptionGuard>
            )}
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="messages" element={<WhatsAppGuard><Messages /></WhatsAppGuard>} />
        <Route path="social-inbox" element={<SocialInbox />} />

        {/* Templates Folder */}
        <Route path="templates">
          <Route index element={<PermissionGuard permission="templates"><WhatsAppGuard><Templates /></WhatsAppGuard></PermissionGuard>} />
          <Route path="create" element={<PermissionGuard permission="templates"><WhatsAppGuard><Templates /></WhatsAppGuard></PermissionGuard>} />
          <Route path="edit/:id" element={<PermissionGuard permission="templates"><WhatsAppGuard><Templates /></WhatsAppGuard></PermissionGuard>} />
          <Route path="system" element={<PermissionGuard permission="templates"><WhatsAppGuard><SystemTemplates /></WhatsAppGuard></PermissionGuard>} />
        </Route>

        {/* Contacts Folder */}
        <Route path="contacts" element={<PermissionGuard permission="contacts"><Contacts /></PermissionGuard>} />
        <Route path="groups" element={<PermissionGuard permission="contacts"><Groups /></PermissionGuard>} />
        <Route path="groups/:groupId" element={<PermissionGuard permission="contacts"><Groups /></PermissionGuard>} />

        {/* Campaigns Folder */}
        <Route path="campaigns">
          <Route index element={<PermissionGuard permission="campaigns"><WhatsAppGuard><Campaigns /></WhatsAppGuard></PermissionGuard>} />
          <Route path="whatsapp" element={<PermissionGuard permission="campaigns"><WhatsAppGuard><Campaigns /></WhatsAppGuard></PermissionGuard>} />
          <Route path="whatsapp/:id" element={<PermissionGuard permission="campaigns"><WhatsAppGuard><CampaignDetail /></WhatsAppGuard></PermissionGuard>} />
          <Route path="create" element={<PermissionGuard permission="campaigns"><WhatsAppGuard><Campaigns /></WhatsAppGuard></PermissionGuard>} />
          <Route path="edit/:id" element={<PermissionGuard permission="campaigns"><WhatsAppGuard><Campaigns /></WhatsAppGuard></PermissionGuard>} />
        </Route>

        {/* WooCommerce Routes */}
        <Route path="woocommerce">
          <Route
            path="orders"
            element={<StoreGuard store="woocommerce"><WooCommerceOrders /></StoreGuard>}
          />
          <Route
            path="orders/:id"
            element={<StoreGuard store="woocommerce"><OrderDetail /></StoreGuard>}
          />
          <Route
            path="automations"
            element={<StoreGuard store="woocommerce"><WooCommerceAutomations /></StoreGuard>}
          />
          <Route
            path="repeat-purchase"
            element={<StoreGuard store="woocommerce"><WooCommerceRepeatPurchase /></StoreGuard>}
          />
        </Route>

        {/* Abandoned Carts */}
        <Route path="abandoned-carts">
          <Route index element={<StoreGuard store="woocommerce"><AbandonedCarts /></StoreGuard>} />
          <Route path=":id" element={<StoreGuard store="woocommerce"><AbandonedCartDetail /></StoreGuard>} />
        </Route>

        {/* Shopify Routes */}
        <Route path="shopify">
          <Route index element={<Navigate to="/shopify/orders" replace />} />
          <Route path="orders" element={<StoreGuard store="shopify"><ShopifyOrders /></StoreGuard>} />
          <Route path="orders/:id" element={<StoreGuard store="shopify"><ShopifyOrderDetail /></StoreGuard>} />
          <Route path="checkouts" element={<StoreGuard store="shopify"><ShopifyAbandoned /></StoreGuard>} />
          <Route path="checkouts/:id" element={<StoreGuard store="shopify"><ShopifyCheckoutDetail /></StoreGuard>} />
        </Route>

        {/* WhatsApp Store / Commerce Routes */}
        <Route path="commerce">
          <Route index element={<Navigate to="/commerce/dashboard" replace />} />
          <Route path="dashboard" element={<WhatsAppGuard><CommerceDashboard /></WhatsAppGuard>} />
          <Route path="products" element={<WhatsAppGuard><Products /></WhatsAppGuard>} />
          <Route path="categories" element={<WhatsAppGuard><Categories /></WhatsAppGuard>} />
          <Route path="catalog-sync" element={<WhatsAppGuard><CatalogSync /></WhatsAppGuard>} />
          <Route path="orders" element={<WhatsAppGuard><Orders /></WhatsAppGuard>} />
          <Route path="orders/:id" element={<WhatsAppGuard><CommerceOrderDetail /></WhatsAppGuard>} />
        </Route>

        {/* Other Routes */}
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<PermissionGuard permission="settings"><Settings /></PermissionGuard>} />
        <Route path="settings/integrations" element={<PermissionGuard permission="settings"><Settings /></PermissionGuard>} />
        <Route path="settings/tags" element={<PermissionGuard permission="settings"><Tags /></PermissionGuard>} />
        <Route path="appointments" element={<PermissionGuard permission="appointments"><Appointments /></PermissionGuard>} />

        {/* NEW AUTOMATION FLOWS */}
        {FEATURES.FLOW_BUILDER && (
          <>
            <Route path="/automation/flows" element={<PermissionGuard permission="automation"><WhatsAppGuard><AutomationFlows /></WhatsAppGuard></PermissionGuard>} />
            <Route path="/automation/flows/:flowId" element={<PermissionGuard permission="automation"><WhatsAppGuard><FlowBuilder /></WhatsAppGuard></PermissionGuard>} />
            <Route path="/automation/flows/new" element={<PermissionGuard permission="automation"><WhatsAppGuard><FlowBuilder /></WhatsAppGuard></PermissionGuard>} />
          </>
        )}

        {/* WHATSAPP FLOWS */}
        <Route path="/automation/whatsapp-flows" element={<PermissionGuard permission="automation"><WhatsAppGuard><WhatsAppFlowsList /></WhatsAppGuard></PermissionGuard>} />
        <Route path="/automation/whatsapp-flows/new" element={<PermissionGuard permission="automation"><WhatsAppGuard><WhatsAppFlowBuilder /></WhatsAppGuard></PermissionGuard>} />
        <Route path="/automation/whatsapp-flows/:flowId" element={<PermissionGuard permission="automation"><WhatsAppGuard><WhatsAppFlowBuilder /></WhatsAppGuard></PermissionGuard>} />
        <Route path="/automation/whatsapp-flows/:flowId/analytics" element={<PermissionGuard permission="automation"><WhatsAppGuard><WhatsAppFlowAnalytics /></WhatsAppGuard></PermissionGuard>} />
        <Route path="/automation/whatsapp-flows/templates" element={<PermissionGuard permission="automation"><WhatsAppGuard><WhatsAppFlowTemplates /></WhatsAppGuard></PermissionGuard>} />
      </Route>

      {/* CATCH ALL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
