import {
  Smile, Mic, Paperclip, Camera, Phone,
  Video, MoreVertical, Check, ChevronLeft, ExternalLink,
  ChevronRight, Smartphone, Image as ImageIcon
} from "lucide-react";
import { getImageUrl } from "../utils/imageHelpers";

function CampaignPreview({ template, campaign, variables = [], headerOverride = null }) {
  console.log("📱 CampaignPreview Header Override Log:", headerOverride);
  // Extract data with comprehensive fallback logic
  const extractData = () => {
    // First try template data (if provided)
    if (template) {
      const bodyText =
        template?.components?.find(c => c.type?.toUpperCase() === "BODY")?.text ||
        template?.body ||
        "";

      const footerText =
        template?.components?.find(c => c.type?.toUpperCase() === "FOOTER")?.text ||
        template?.footer ||
        "";

      const headerComponent = template?.components?.find(c => c.type?.toUpperCase() === "HEADER");
      const headerText = headerComponent?.text || template?.header?.text || "";
      const headerType = (headerComponent?.format || template?.header?.type || "").toUpperCase();

      const buttonsComponent = template?.components?.find(c => c.type?.toUpperCase() === "BUTTONS");
      const buttons = buttonsComponent?.buttons || template?.buttons || [];

      const getMediaUrl = () => {
        // 0. Use Manual Override if provided (Highest Priority)
        if (headerOverride) return headerOverride;

        // Safe resolver for Meta's array-or-string format
        const resolveValue = (val) => {
          if (!val) return null;
          if (Array.isArray(val) && val.length > 0) return val[0];
          if (typeof val === 'string' && val.length > 5) return val;
          return null;
        };

        // 1. Check Campaign Model's stored override
        if (campaign?.headerOverrideUrl) return campaign.headerOverrideUrl;
        if (campaign?.headerOverrideHandle) return campaign.headerOverrideHandle;

        // 2. Check HEADER component's example (Meta format)
        const example = headerComponent?.example;
        if (example) {
          const media = resolveValue(example.header_handle) ||
            resolveValue(example.image_url) ||
            resolveValue(example.video_url) ||
            resolveValue(example.header_url);
          if (media) return media;
        }

        // 3. Check direct template header fallbacks (Local format)
        const h = template?.header;
        if (h) {
          const media = resolveValue(h.example?.image_url) ||
            resolveValue(h.example?.video_url) ||
            resolveValue(h.image) ||
            resolveValue(h.mediaUrl);
          if (media) return media;
        }

        // 4. Last resort fallbacks
        if (template?.previewImageUrl) return template.previewImageUrl;
        if (campaign?.template?.header?.image) return campaign.template.header.image;

        return null;
      };

      return {
        bodyText,
        footerText,
        headerText,
        headerType,
        buttons,
        headerMediaUrl: getMediaUrl()
      };
    }

    // Default empty state
    return {
      bodyText: "",
      footerText: "",
      headerText: "",
      headerType: "",
      buttons: [],
      headerMediaUrl: null
    };
  };

  const data = extractData();
  const bodyText = data.bodyText;
  const footerText = data.footerText;
  const headerText = data.headerText;
  const headerType = String(data.headerType || "").toUpperCase(); // ✅ Force Uppercase
  const buttons = data.buttons;
  const headerMediaUrl = data.headerMediaUrl;

  // Variable replacement function
  const replaceVariables = (text) => {
    if (!text) return "";
    let result = String(text);
    variables.forEach((v, i) => {
      // Use value if present, else use fallback
      const replacement = (v && typeof v === 'object' && v.value) ? v.value :
        (v && typeof v === 'string') ? v :
          `[Var ${i + 1}]`;

      const targetIndex = (v && v.index) ? v.index : (i + 1);
      result = result.replace(
        new RegExp(`\\{\\{${targetIndex}\\}\\}`, "g"),
        replacement
      );
    });
    return result;
  };

  const previewBody = replaceVariables(bodyText);
  const previewFooter = replaceVariables(footerText);
  const previewHeader = replaceVariables(headerText);

  return (
    <div className="flex flex-col items-center w-full max-w-[340px] mx-auto">
      <style>{`
        .iphone-frame {
          width: 290px;
          height: 600px;
          background: #111b21;
          border-radius: 44px;
          padding: 8px;
          border: 4px solid #1f2c34;
          position: relative;
        }

        .iphone-frame::before {
          content: "";
          position: absolute;
          left: -6px;
          top: 100px;
          width: 4px;
          height: 30px;
          background: #1f2c34;
          border-radius: 2px 0 0 2px;
          box-shadow: 0 40px 0 #1f2c34, 0 80px 0 #1f2c34;
        }

        .iphone-frame::after {
          content: "";
          position: absolute;
          right: -6px;
          top: 140px;
          width: 4px;
          height: 50px;
          background: #1f2c34;
          border-radius: 0 2px 2px 0;
        }

        .iphone-screen {
          width: 100%;
          height: 100%;
          background: #fff;
          border-radius: 36px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        .message-bubble {
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 1.5px 2px rgba(0,0,0,0.1);
          position: relative;
          max-width: 92%;
          margin-left: 14px;
          margin-bottom: 8px;
          word-break: break-word;
          overflow-wrap: anywhere;
          z-index: 10;
        }

        .message-tail {
          position: absolute;
          top: 0;
          left: -8px;
          width: 12px;
          height: 13px;
          background: #fff;
          clip-path: polygon(100% 0, 100% 100%, 0 0);
          z-index: 10;
        }

        .chat-preview-container {
          flex: 1;
          background-color: #efeae2;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .whatsapp-chat-bg {
          position: absolute;
          inset: 0;
          background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
          background-size: 380px;
          background-repeat: repeat;
          opacity: 0.4;
          pointer-events: none;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.15);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.25);
        }
      `}</style>

      {/* Preview Header Title */}
      <div className="w-full flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-soft">
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Live Channel</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Real-time Visualization</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</span>
        </div>
      </div>

      <div className="iphone-frame font-poppins scale-[0.85] xl:scale-[0.9] origin-top mb-[-60px]">
        <div className="iphone-screen">
          {/* WhatsApp Header - Minimalist Style */}
          <div className="bg-[#005d4b] text-white py-4 shrink-0 flex items-center px-4 gap-4 z-40">
            <ChevronLeft className="w-5 h-5 cursor-pointer opacity-80 -ml-1" />
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-[15px] font-black border border-white/30 shadow-sm uppercase shrink-0">
              Z
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold tracking-tight truncate leading-tight">Zepofy</p>
            </div>
          </div>

          {/* Chat Area */}
          <div className="chat-preview-container">
            <div className="whatsapp-chat-bg"></div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col custom-scrollbar relative z-10">


              {/* Message Bubble (Incoming Style) */}
              <div className="message-bubble mt-2 animate-in slide-in-from-left-4 duration-300">
                <div className="message-tail"></div>

                {/* Header Media Rendering */}
                {(headerType === "IMAGE" || headerType === "VIDEO" || headerType === "MEDIA") && (
                  <div className="rounded-md overflow-hidden mb-2 bg-white flex items-center justify-center border border-slate-100 min-h-[120px] relative">
                    {headerMediaUrl ? (
                      <img
                        src={getImageUrl(headerMediaUrl)}
                        alt="Header"
                        className="w-full h-auto object-cover max-h-[160px]"
                        onError={(e) => {
                          console.warn("❌ Preview Image Load Failed:", headerMediaUrl);
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <ImageIcon size={32} strokeWidth={1.5} />
                        <span className="text-[10px] font-medium tracking-tight">No image selected</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Header Text */}
                {headerType === "TEXT" && previewHeader && (
                  <div className="font-bold text-[13px] mb-1 text-slate-900 leading-tight">
                    {previewHeader}
                  </div>
                )}

                {/* Body Content */}
                <div className="text-[13px] whitespace-pre-wrap text-[#111b21] leading-[1.4] mb-1 font-medium">
                  {previewBody ? (
                    previewBody.split(/({{\d+}})/).map((part, index) => {
                      if (part.match(/{{\d+}}/)) {
                        return <span key={index} className="text-[#00a884] bg-[#00a884]/10 px-1 rounded font-bold">{part}</span>;
                      }
                      return part;
                    })
                  ) : (
                    <span className="text-slate-400 italic">No content...</span>
                  )}
                </div>

                {/* Footer */}
                {previewFooter && (
                  <div className="text-[10px] text-[#667781] leading-tight mb-2 opacity-60">
                    {previewFooter}
                  </div>
                )}

                {/* Interaction Buttons - Inside Bubble */}
                {buttons && buttons.length > 0 && (
                  <div className="mt-3 -mx-[10px] -mb-[10px] border-t border-slate-100 flex flex-col divide-y divide-slate-100 bg-slate-50/50 rounded-b-lg">
                    {buttons.map((b, i) => (
                      <div key={i} className="py-2.5 text-center text-[12px] font-bold text-[#00a884] transition-colors flex items-center justify-center gap-2">
                        {b.type === "URL" && <ExternalLink className="w-3.5 h-3.5" />}
                        {b.type === "PHONE_NUMBER" && <Phone className="w-3.5 h-3.5" />}
                        {b.text || b.label || `Action ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#f0f2f5] p-2.5 flex items-center gap-2.5 border-t border-slate-200/60 pb-4 shrink-0">
              <div className="flex-1 bg-white h-10 rounded-full px-4 flex items-center gap-3 shadow-sm border border-slate-100">
                <Smile className="w-5 h-5 text-slate-400" />
                <span className="text-[12px] text-slate-400 flex-1 font-medium">Type a message...</span>
              </div>
              <div className="bg-[#00a884] w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 active:scale-90 transition-transform">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignPreview;
