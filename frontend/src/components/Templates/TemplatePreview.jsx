import { FiSmile, FiMic, FiPaperclip, FiCamera, FiPhone, FiVideo, FiMoreVertical, FiCheck, FiChevronLeft, FiExternalLink } from "react-icons/fi";
import { Image as ImageIcon } from "lucide-react";
import { getImageUrl } from "../../utils/imageHelpers";

export default function TemplatePreview({
  headerType,
  headerText,
  headerImage,
  bodyText,
  footer,
  buttons,
  variableValues = {}
}) {
  // Replace variables in body with sample values for preview
  let previewBodyText = bodyText || "";

  // Use regex to find and replace {{1}}, {{2}}... with values from variableValues
  const variablesFound = previewBodyText.match(/{{\d+}}/g) || [];
  variablesFound.forEach(v => {
    const val = variableValues[v];
    if (val && val.trim() !== "") {
      // Use a temporary unique marker to avoid recursive replacements if a value contains {{x}}
      previewBodyText = previewBodyText.split(v).join(val);
    }
  });

  const previewBody = previewBodyText;

  // Image resolving now handled by centralized getImageUrl helper

  const displayImageUrl = getImageUrl(headerImage);

  return (
    <div className="flex justify-center w-full">
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

        /* Physical Buttons */
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
          opacity: 0.9;
          pointer-events: none;
        }

        .message-bubble {
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 1px 1px rgba(0,0,0,0.08);
          position: relative;
          max-width: 88%;
          margin-left: 14px;
          margin-bottom: 4px;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .message-tail {
          position: absolute;
          top: 0;
          left: -8px;
          width: 12px;
          height: 13px;
          background: #fff;
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
        }

        .send-button-green {
          background: #00a884;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="iphone-frame">
        <div className="iphone-screen">
          <div className="flex flex-col h-full relative">
            
            {/* WhatsApp Header */}
            <div className="bg-[#005d4b] text-white py-4 shrink-0 flex items-center px-4 gap-4 z-40 relative shadow-sm">
              <FiChevronLeft className="w-5 h-5 cursor-pointer opacity-80 -ml-1" />
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

                  {/* Header Image */}
                  {(headerType?.toLowerCase() === "image" || headerType?.toLowerCase() === "media") && (
                    <div className="rounded-md overflow-hidden mb-2 bg-slate-50 flex items-center justify-center border border-slate-100 min-h-[120px]">
                    {displayImageUrl ? (
                      <img
                        src={displayImageUrl}
                        alt="Header"
                        className="w-full h-auto object-cover max-h-[160px]"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        <ImageIcon className="w-8 h-8 text-slate-200 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Media Content</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Header Text */}
                {headerType === "text" && headerText && (
                  <div className="font-bold text-[13px] mb-1 text-slate-900 leading-tight">
                    {headerText}
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
                    <span className="text-slate-400 italic">No blueprint content...</span>
                  )}
                </div>

                {/* Footer Text */}
                {footer && (
                  <div className="text-[10px] text-[#667781] leading-tight mb-2 opacity-60">
                    {footer}
                  </div>
                )}

                {/* Interaction Buttons */}
                {buttons && buttons.length > 0 && (
                  <div className="mt-3 -mx-[10px] -mb-[10px] border-t border-slate-100 flex flex-col divide-y divide-slate-100 bg-slate-50/50 rounded-b-lg">
                    {buttons.map((b, i) => (
                      <div key={i} className="py-2.5 text-center text-[12px] font-bold text-[#00a884] transition-colors flex items-center justify-center gap-2">
                        {b.type === "URL" && <FiExternalLink className="w-3.5 h-3.5" />}
                        {b.type === "PHONE_NUMBER" && <FiPhone className="w-3.5 h-3.5" />}
                        {b.text || b.label || `Action ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Meta Double Ticks / Time */}
                <div className="absolute right-2 bottom-1 flex items-center gap-1 opacity-0">
                  <span className="text-[9px] text-slate-400">12:00 PM</span>
                </div>
              </div>

              {/* Scroll Spacer to prevent bottom padding bug */}
              <div className="h-10 shrink-0 w-full"></div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#f0f2f5] p-2.5 flex items-center gap-2.5 border-t border-slate-200/60 pb-4 shrink-0 relative z-10">
              <div className="flex-1 bg-white h-10 rounded-full px-4 flex items-center gap-3 shadow-sm border border-slate-100">
                <FiSmile className="w-5 h-5 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" />
                <span className="text-[12px] text-slate-400 flex-1 font-medium">Type a message...</span>
              </div>
              <div className="send-button-green shrink-0 active:scale-90 transition-transform cursor-pointer">
                <FiCheck className="w-5 h-5" strokeWidth={3} />
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
