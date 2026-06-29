import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import {
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiSettings,
  FiLink,
  FiMessageSquare,
  FiSave,
  FiExternalLink,
  FiInfo,
  FiZap,
  FiShield,
  FiRefreshCw,
  FiActivity,
  FiKey,
  FiPhone,
  FiGlobe,
  FiClock,
  FiCopy,
  FiChevronRight,
  FiLock,
  FiUser,
  FiDatabase,
  FiTerminal,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";

const FacebookIcon = () => (
  <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function WhatsAppIntegrations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sessionDataRef = useRef(null);
  const authCodeRef = useRef(null);
  const exchangeInProgressRef = useRef(false);

  // Form state - EXACT field names as required by backend
  const [formData, setFormData] = useState({
    wabaId: "",
    phoneNumberId: "",
    businessPhoneNumber: "", // Changed from businessPhone
    accessToken: "",
    appId: "",
  });

  // Integration status
  const [integration, setIntegration] = useState(null);
  const [connected, setConnected] = useState(false);

  // UI state
  const [showInstructions, setShowInstructions] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState("connect");

  const WEBHOOK_BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
  const webhookUrl = `${WEBHOOK_BASE}/api/webhook/whatsapp/${integration?.userId || 'USER_ID'}`;

  // Load Meta Facebook SDK for Embedded Signup
  useEffect(() => {
    // Must define fbAsyncInit BEFORE the script loads
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v25.0'
      });
      console.log('✅ FB SDK initialized');

      window.addEventListener('message', (event) => {
        if (event.origin !== "https://www.facebook.com") return;
        console.log('Raw FB postMessage event:', event.data);
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          console.log('Parsed FB postMessage:', data);
          if (data.type === 'WA_EMBEDDED_SIGNUP') {
            if (data.event === 'FINISH') {
              sessionDataRef.current = {
                phone_number_id: data.data.phone_number_id,
                waba_id: data.data.waba_id
              };
              console.log('Meta session info stored:', sessionDataRef.current);
            }
          }
        } catch(e) {
          console.error('Error parsing FB postMessage event:', e);
        }
      });
    };

    // Only load script once
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    api.get("/whatsapp/integration").then(res => {
      setIntegration(res.data);
    });
  }, []);

  useEffect(() => {
    loadIntegration();
  }, []);

  const handleFacebookConnect = () => {
    if (!window.FB) {
      setError('Facebook SDK is still loading. Please wait 2 seconds and try again.');
      return;
    }
    
    setFbLoading(true);
    setError('');
    
    // Clear refs from previous click
    sessionDataRef.current = null;
    authCodeRef.current = null;
    exchangeInProgressRef.current = false;
    
    const exchangeCodeWithBackend = (code, session) => {
      if (exchangeInProgressRef.current) return;
      exchangeInProgressRef.current = true;

      api
        .post("/integrations/whatsapp/embedded-signup", { 
          code,
          phone_number_id: session.phone_number_id,
          waba_id: session.waba_id
        })
        .then(async (res) => {
          if (res.data.success) {
            setSuccess("WhatsApp connected via Facebook successfully!");
            setConnected(true);
            setIntegration(res.data.data || res.data.integration);
            await loadIntegration();
          } else {
            setError(res.data.error || "Failed to connect via Facebook");
          }
        })
        .catch((err) => {
          console.error("Facebook connect backend error:", err);
          setError(err.response?.data?.error || "Failed to connect via Facebook");
        })
        .finally(() => {
          setFbLoading(false);
          exchangeInProgressRef.current = false;
        });
    };

    window.FB.login(
      function(response) {
        if (response.authResponse && response.authResponse.code) {
          authCodeRef.current = response.authResponse.code;
          if (sessionDataRef.current) {
            exchangeCodeWithBackend(response.authResponse.code, sessionDataRef.current);
          } else {
            // Check every 100ms for session info, up to 5 seconds
            let checkInterval = setInterval(() => {
              if (sessionDataRef.current) {
                clearInterval(checkInterval);
                exchangeCodeWithBackend(authCodeRef.current, sessionDataRef.current);
              }
            }, 100);
            
            setTimeout(() => {
              clearInterval(checkInterval);
              if (!sessionDataRef.current) {
                setFbLoading(false);
                setError('Facebook login completed, but WABA session info was not received. Please try again.');
              }
            }, 20000);
          }
        } else {
          setFbLoading(false);
          setError('Facebook login was cancelled or failed.');
        }
      },
      {
        config_id: import.meta.env.VITE_META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureName: 'whatsapp_embedded_signup',
          sessionInfoVersion: '3',
          featureType: 'whatsapp_business_app_onboarding'
        },
        scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management'
      }
    );
  };

  const loadIntegration = async () => {
    try {
      const res = await api.get("/integrations/whatsapp");
      if (res.data.success) {
        setIntegration(res.data.data);
        setConnected(res.data.data?.status === 'connected');
        if (res.data.data) {
          setFormData({
            wabaId: res.data.data.wabaId || "",
            phoneNumberId: res.data.data.phoneNumberId || "",
            businessPhoneNumber: res.data.data.businessPhoneNumber || "",
            accessToken: "",
            appId: res.data.data.appId || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load integration:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
    setSuccess("");
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/integrations/whatsapp/connect", formData);

      if (res.data.success) {
        setSuccess("WhatsApp Business API connected successfully!");
        setConnected(true);
        setIntegration(res.data.integration);
        await loadIntegration(); // Reload to get masked token
      } else {
        setError(res.data.error || "Connection failed");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(err.response?.data?.error || "Failed to connect WhatsApp Business API");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/integrations/whatsapp/connect", formData);

      if (res.data.success) {
        setSuccess("WhatsApp integration updated successfully!");
        setConnected(true);
        setIntegration(res.data.integration);
        await loadIntegration();
      } else {
        setError(res.data.error || "Update failed");
      }
    } catch (err) {
      console.error("Update error:", err);
      setError(err.response?.data?.error || "Failed to update WhatsApp integration");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp? This will stop all messaging.")) return;

    setLoading(true);
    try {
      const res = await api.post("/integrations/whatsapp/disconnect");

      if (res.data.success) {
        setSuccess("WhatsApp disconnected successfully");
        setConnected(false);
        setIntegration(null);
        setFormData({
          wabaId: "",
          phoneNumberId: "",
          businessPhoneNumber: "",
          accessToken: "",
          appId: "",
        });
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      setError(err.response?.data?.error || "Failed to disconnect WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/integrations/whatsapp/test");

      if (res.data.success) {
        setSuccess("Connection test successful!");
      } else {
        setError(res.data.error || "Connection test failed");
      }
    } catch (err) {
      console.error("Test error:", err);
      setError(err.response?.data?.error || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleRegenerateWebhookToken = async () => {
    if (!confirm("Are you sure you want to regenerate the webhook token? You'll need to update the webhook configuration in Meta Business Manager.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/integrations/whatsapp/regenerate-webhook-token");

      if (res.data.success) {
        setSuccess("Webhook token regenerated successfully!");
        await loadIntegration(); // Reload to get new token
      } else {
        setError(res.data.error || "Failed to regenerate webhook token");
      }
    } catch (err) {
      console.error("Regenerate token error:", err);
      setError(err.response?.data?.error || "Failed to regenerate webhook token");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  // ✅ ADDED: Step-by-step guide data for permanent access token
  const tokenSteps = [
    {
      step: 1,
      title: "Open Meta Developers Dashboard",
      description: "Navigate to the Meta for Developers website and sign in to your account.",
      icon: <FiGlobe className="w-5 h-5" />,
      action: {
        text: "Open Meta Developers",
        url: "https://developers.facebook.com"
      }
    },
    {
      step: 2,
      title: "Select your WhatsApp Business App",
      description: "Choose your existing WhatsApp Business App from the dashboard or create a new one.",
      icon: <FiMessageSquare className="w-5 h-5" />
    },
    {
      step: 3,
      title: "Generate System User Access Token",
      description: "Go to App Settings → Roles → Add System User → Generate Access Token with permanent expiration.",
      icon: <FiKey className="w-5 h-5" />
    },
    {
      step: 4,
      title: "Assign WhatsApp Permissions",
      description: "Ensure the system user has WhatsApp Business API permissions: messages, message_status, template_status.",
      icon: <FiShield className="w-5 h-5" />
    },
    {
      step: 5,
      title: "Copy Permanent Access Token",
      description: "Copy the generated access token. It will be a long string starting with 'EAAD...'",
      icon: <FiCopy className="w-5 h-5" />
    },
    {
      step: 6,
      title: "Paste Token and Connect",
      description: "Return to this page, paste your access token, fill in other details, and click Connect.",
      icon: <FiZap className="w-5 h-5" />
    }
  ];

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="w-full">
          {/* HEADER */}
          <div className="bg-transparent border-none">
            <div className="px-6 py-8 lg:px-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-[12px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <FiMessageSquare className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-900 tracking-tight">WhatsApp Integration</h1>
                  <p className="text-slate-600 mt-2 text-base">
                    Connect your WhatsApp Business API to enable automated messaging and customer engagement.
                  </p>
                </div>
              </div>

              {/* ✅ ADDED: Status Badge */}
              <div className="flex items-center gap-4">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${connected
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                  {connected ? (
                    <>
                      <FiCheckCircle className="w-4 h-4" />
                      Connected
                    </>
                  ) : (
                    <>
                      <FiXCircle className="w-4 h-4" />
                      Not Connected
                    </>
                  )}
                </div>

                {connected && (
                  <div className="text-sm text-slate-500">
                    Connected {integration?.connectedAt ? new Date(integration.connectedAt).toLocaleDateString() : 'recently'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ✨ UI IMPROVEMENT: Full width tabs container */}
          <div className="bg-transparent border-none">
            <div className="px-6 lg:px-8">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab("connect")}
                  className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === "connect"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                >
                  <FiZap className="inline w-4 h-4 mr-2" />
                  Connect WhatsApp
                </button>
                <button
                  onClick={() => setActiveTab("webhook")}
                  className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === "webhook"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                >
                  <FiLink className="inline w-4 h-4 mr-2" />
                  Webhook Configuration
                </button>
                <button
                  onClick={() => setActiveTab("guide")}
                  className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === "guide"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                >
                  <FiInfo className="inline w-4 h-4 mr-2" />
                  How to Get Token
                </button>
              </nav>
            </div>
          </div>

          {/* ✏️ UPDATED LAYOUT: Full width responsive grid */}
          <div className="px-6 py-8 lg:px-8">
            {activeTab === "connect" ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN - MAIN CONTENT (8 cols) */}
                <div className="lg:col-span-8 space-y-8">
                  {/* STATUS CARD */}
                  <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">WhatsApp Business API Status</h2>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${connected
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                        }`}>
                        {connected ? (
                          <>
                            <FiCheckCircle className="w-4 h-4" />
                            Connected
                          </>
                        ) : (
                          <>
                            <FiXCircle className="w-4 h-4" />
                            Not Connected
                          </>
                        )}
                      </div>
                    </div>

                    {integration && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[12px]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-[12px] flex items-center justify-center">
                              <FiPhone className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Phone Number</div>
                              <div className="text-sm text-slate-600">{integration.businessPhoneNumber}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[12px]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-[12px] flex items-center justify-center">
                              <FiZap className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">WABA ID</div>
                              <div className="text-sm text-slate-600">{integration.wabaId}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[12px]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-[12px] flex items-center justify-center">
                              <FiClock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Connected At</div>
                              <div className="text-sm text-slate-600">
                                {integration.connectedAt ? new Date(integration.connectedAt).toLocaleString() : "Never"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                          <button
                            onClick={handleTestConnection}
                            disabled={testing}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-[12px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <FiActivity className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
                            {testing ? "Testing..." : "Test Connection"}
                          </button>

                          {connected && (
                            <button
                              onClick={handleDisconnect}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-[12px] font-semibold transition-colors disabled:opacity-50"
                            >
                              <FiXCircle className="w-4 h-4" />
                              {loading ? "Revoking..." : "REVOKE ACCESS"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ✨ UI IMPROVEMENT: Connect WhatsApp Form */}
                  <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-8">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Connect WhatsApp Form</h3>
                      <p className="text-slate-600">Enter your WhatsApp Business API credentials to establish connection.</p>
                    </div>

                    {!connected && (
                      <>
                        <div className="mb-6">
                          <button
                            type="button"
                            onClick={handleFacebookConnect}
                            disabled={fbLoading}
                            className="w-full flex items-center justify-center px-6 py-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-[12px] font-semibold transition-colors disabled:opacity-50 text-base shadow-sm"
                          >
                            <FacebookIcon />
                            {fbLoading ? "Connecting..." : "Connect with Facebook"}
                          </button>
                        </div>

                        <div className="flex items-center my-6">
                          <div className="flex-1 border-t border-slate-200"></div>
                          <span className="px-4 text-sm text-slate-400 font-medium bg-white">OR enter credentials manually</span>
                          <div className="flex-1 border-t border-slate-200"></div>
                        </div>
                      </>
                    )}

                    <form onSubmit={connected ? handleUpdate : handleConnect} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-base font-semibold text-slate-700 mb-4">
                            <div className="flex items-center gap-3">
                              <FiDatabase className="w-5 h-5 text-slate-400" />
                              WABA ID
                              <div className="group relative">
                                <FiInfo className="w-4 h-4 text-slate-400 cursor-help" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  WhatsApp Business Account ID
                                </div>
                              </div>
                            </div>
                          </label>
                          <input
                            type="text"
                            name="wabaId"
                            value={formData.wabaId}
                            onChange={handleInputChange}
                            placeholder="1234567890123456"
                            required
                            className="w-full px-5 py-4 rounded-[12px] border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-base"
                          />
                        </div>

                        <div>
                          <label className="block text-base font-semibold text-slate-700 mb-4">
                            <div className="flex items-center gap-3">
                              <FiPhone className="w-5 h-5 text-slate-400" />
                              Phone Number ID
                              <div className="group relative">
                                <FiInfo className="w-4 h-4 text-slate-400 cursor-help" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  Your WhatsApp phone number ID
                                </div>
                              </div>
                            </div>
                          </label>
                          <input
                            type="text"
                            name="phoneNumberId"
                            value={formData.phoneNumberId}
                            onChange={handleInputChange}
                            placeholder="1234567890123456"
                            required
                            className="w-full px-5 py-4 rounded-[12px] border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-base"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-4">
                          <div className="flex items-center gap-3">
                            <FiPhone className="w-5 h-5 text-slate-400" />
                            Business Phone Number
                          </div>
                        </label>
                        <input
                          type="text"
                          name="businessPhoneNumber"
                          value={formData.businessPhoneNumber}
                          onChange={handleInputChange}
                          placeholder="+1234567890"
                          required
                          className="w-full px-5 py-4 rounded-[12px] border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-base"
                        />
                      </div>

                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-4">
                          <div className="flex items-center gap-3">
                            <FiKey className="w-5 h-5 text-slate-400" />
                            Permanent Access Token
                            <div className="group relative">
                              <FiInfo className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                System User Access Token with permanent expiration
                              </div>
                            </div>
                          </div>
                        </label>
                        <div className="relative">
                          <input
                            type={showToken ? "text" : "password"}
                            name="accessToken"
                            value={formData.accessToken}
                            onChange={handleInputChange}
                            placeholder="EAAD..."
                            required
                            className="w-full px-5 py-4 pr-14 rounded-[12px] border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-base"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
                          >
                            {showToken ? <FiEyeOff className="w-6 h-6" /> : <FiEye className="w-6 h-6" />}
                          </button>
                        </div>
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
                          <div className="flex items-start gap-3">
                            <FiLock className="w-5 h-5 text-amber-600 mt-0.5" />
                            <p className="text-sm text-amber-700">
                              <strong>Security Notice:</strong> Never share your access token with anyone. Treat it like a password.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-4">
                          <div className="flex items-center gap-3">
                            <FiSettings className="w-5 h-5 text-slate-400" />
                            App ID (Optional)
                            <div className="group relative">
                              <FiInfo className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                Your Meta Business App ID (optional)
                              </div>
                            </div>
                          </div>
                        </label>
                        <input
                          type="text"
                          name="appId"
                          value={formData.appId}
                          onChange={handleInputChange}
                          placeholder="1234567890123456"
                          className="w-full px-5 py-4 rounded-[12px] border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-base"
                        />
                      </div>

                      <div className="flex gap-6">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md disabled:bg-blue-400 text-white rounded-[12px] font-semibold transition-colors text-base"
                        >
                          <FiZap className="w-5 h-5" />
                          {loading ? "Processing..." : (connected ? "Update Connection" : "Connect WhatsApp")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* ✨ UI IMPROVEMENT: RIGHT COLUMN - PERMANENT TOKEN STEPS (4 cols) */}
                <div className="lg:col-span-4 space-y-8">
                  {/* PERMANENT ACCESS TOKEN STEPS */}
                  <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-6 sticky top-8">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <FiKey className="w-5 h-5 text-blue-600" />
                        Permanent Access Token Steps
                      </h3>
                      <p className="text-slate-600 text-sm">Follow these steps to get your WhatsApp API token.</p>
                    </div>

                    <div className="space-y-4">
                      {tokenSteps.map((step, index) => (
                        <div key={step.step} className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 text-sm mb-1">{step.title}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                            {step.action && (
                              <a
                                href={step.action.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                {step.action.text}
                                <FiExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FiAlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-900 text-sm mb-1">Important</h4>
                          <p className="text-xs text-amber-700">Generate a System User Access Token with permanent expiration for uninterrupted service.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WEBHOOK INFO */}
                  {connected && integration && (
                    <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-6">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <FiLink className="w-5 h-5 text-blue-600" />
                        Webhook Information
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Webhook URL</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={webhookUrl}
                              readOnly
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            />
                            <button
                              onClick={() => copyToClipboard(webhookUrl)}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                            >
                              <FiCopy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Verify Token</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={integration?.webhookVerifyToken || ""}
                              readOnly
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            />

                            <button
                              onClick={() => copyToClipboard(integration.webhookVerifyToken)}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                            >
                              <FiCopy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            <strong>Events:</strong> messages, message_status, template_status
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "webhook" ? (
              /* WEBHOOK CONFIGURATION TAB */
              <div className="max-w-4xl mx-auto">
                {!connected ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-slate-100 rounded-[12px] flex items-center justify-center mx-auto mb-4">
                      <FiLink className="w-8 h-8 text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect WhatsApp First</h2>
                    <p className="text-slate-600 mb-6">You need to connect your WhatsApp Business API before configuring webhooks.</p>
                    <button
                      onClick={() => setActiveTab("connect")}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md text-white rounded-[12px] font-semibold transition-colors"
                    >
                      <FiZap className="w-5 h-5" />
                      Connect WhatsApp
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Webhook Status Header */}
                    <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center ${integration?.webhookConfigured
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-amber-100 text-amber-600'
                            }`}>
                            {integration?.webhookConfigured ? (
                              <FiCheckCircle className="w-6 h-6" />
                            ) : (
                              <FiAlertCircle className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-slate-900">Webhook Configuration</h2>
                            <p className="text-slate-600">Configure webhook to receive customer replies</p>
                          </div>
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-semibold border ${integration?.webhookConfigured
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                          {integration?.webhookConfigured ? "Configured" : "Not Configured"}
                        </div>
                      </div>

                      {!integration?.webhookConfigured && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
                          <div className="flex items-start gap-3">
                            <FiAlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-amber-900 mb-1">⚠️ Webhook Not Configured</h4>
                              <p className="text-sm text-amber-700">
                                Customer replies will NOT appear in your Messages UI until you configure the webhook in Meta Business Manager.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Webhook Configuration Details */}
                    <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-8">
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Webhook Configuration Details</h3>

                      <div className="space-y-6">
                        {/* Webhook URL */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            <div className="flex items-center gap-2">
                              <FiGlobe className="w-4 h-4" />
                              Webhook URL
                            </div>
                          </label>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={webhookUrl}
                              readOnly
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-[12px] text-slate-800 font-mono text-sm"
                            />
                            <button
                              onClick={() => copyToClipboard(webhookUrl)}
                              className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-[12px] transition-colors font-medium"
                            >
                              <FiCopy className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">This URL receives customer replies from Meta</p>
                        </div>

                        {/* Verify Token */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-3">
                            <div className="flex items-center gap-2">
                              <FiKey className="w-4 h-4" />
                              Verify Token
                            </div>
                          </label>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={integration?.webhookVerifyToken || 'GENERATING...'}
                              readOnly
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-[12px] text-slate-800 font-mono text-sm"
                            />
                            <button
                              onClick={() => copyToClipboard(integration?.webhookVerifyToken)}
                              className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-[12px] transition-colors font-medium"
                            >
                              <FiCopy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={handleRegenerateWebhookToken}
                              disabled={loading}
                              className="px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-[12px] transition-colors font-medium disabled:opacity-50"
                              title="Regenerate webhook token"
                            >
                              <FiRefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">Unique token for webhook verification</p>
                        </div>

                        {/* Webhook Events */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-[12px]">
                          <h4 className="font-semibold text-blue-900 mb-2">Required Webhook Events</h4>
                          <div className="space-y-1 text-sm text-blue-700">
                            <div className="flex items-center gap-2">
                              <FiCheckCircle className="w-4 h-4" />
                              <strong>messages:</strong> Receive customer messages and replies
                            </div>
                            <div className="flex items-center gap-2">
                              <FiCheckCircle className="w-4 h-4" />
                              <strong>message_status:</strong> Track delivery status
                            </div>
                            <div className="flex items-center gap-2">
                              <FiCheckCircle className="w-4 h-4" />
                              <strong>template_status:</strong> Monitor template approval
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Instructions */}
                    <div className="bg-white rounded-[12px] border border-slate-200/60 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] p-8">
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Configuration Instructions</h3>

                      <div className="space-y-6">
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Open Meta Business Manager</h4>
                            <p className="text-slate-600 text-sm">Go to Meta Business Manager and select your WhatsApp Business Account.</p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Navigate to WhatsApp Settings</h4>
                            <p className="text-slate-600 text-sm">Click on WhatsApp → Configure → Webhook.</p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Enter Webhook Details</h4>
                            <p className="text-slate-600 text-sm mb-3">Paste the Webhook URL and Verify Token from above:</p>
                            <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-4 font-mono text-sm">
                              <div className="mb-2"><strong>Callback URL:</strong> {integration?.webhookUrl || 'URL above'}</div>
                              <div><strong>Verify Token:</strong> {integration?.webhookVerifyToken || 'Token above'}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            4
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Select Webhook Events</h4>
                            <p className="text-slate-600 text-sm">Enable: <strong>messages</strong>, <strong>message_status</strong>, and <strong>template_status</strong>.</p>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            5
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Verify and Save</h4>
                            <p className="text-slate-600 text-sm">Click "Verify and save". Meta will test your webhook and confirm it's working.</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-[12px]">
                        <div className="flex items-start gap-3">
                          <FiCheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-900 mb-1">✅ Configuration Complete</h4>
                            <p className="text-sm text-blue-700">
                              Once configured, customer replies will automatically appear in your Messages UI. The webhook status will update to "Configured".
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GUIDE TAB */
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-[12px] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <FiKey className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">How to Get Permanent Access Token</h2>
                  <p className="text-slate-600">Follow these step-by-step instructions to generate your WhatsApp Business API access token</p>
                </div>

                <div className="space-y-6">
                  {tokenSteps.map((step, index) => (
                    <div key={step.step} className="bg-white border border-slate-200/60 rounded-[12px] p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                            {step.step}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              {step.icon}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                          </div>
                          <p className="text-slate-600 mb-4">{step.description}</p>

                          {step.action && (
                            <a
                              href={step.action.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md text-white rounded-lg font-medium transition-colors"
                            >
                              <FiExternalLink className="w-4 h-4" />
                              {step.action.text}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-[12px]">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-2">Important Notes</h4>
                      <ul className="text-sm text-amber-800 space-y-1">
                        <li>• Generate a System User Access Token, not a temporary one</li>
                        <li>• Set token expiration to "Never" for permanent access</li>
                        <li>• Assign proper WhatsApp permissions to the system user</li>
                        <li>• Keep your access token secure and never share it publicly</li>
                        <li>• You can always regenerate a new token if needed</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setActiveTab("connect")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md text-white rounded-lg font-semibold transition-colors"
                  >
                    <FiZap className="w-5 h-5" />
                    Go to Connection Form
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ERROR & SUCCESS MESSAGES */}
        <>
          {error && (
            <div className="fixed top-4 right-4 max-w-md bg-red-50 border border-red-200 rounded-[12px] p-4 shadow-lg z-50">
              <div className="flex items-start gap-3">
                <FiXCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="fixed top-4 right-4 max-w-md bg-blue-50 border border-blue-200 rounded-[12px] p-4 shadow-lg z-50">
              <div className="flex items-start gap-3">
                <FiCheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Success</h4>
                  <p className="text-sm text-blue-700 mt-1">{success}</p>
                </div>
              </div>
            </div>
          )}
        </>
      </div>
    </>
  );
}

