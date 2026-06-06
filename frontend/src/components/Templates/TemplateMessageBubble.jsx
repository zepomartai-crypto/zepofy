import React from "react";
import { getImageUrl } from "../../utils/imageHelpers";

export default function TemplateMessageBubble({ msg, onButtonClick, clickedButtons, messageId }) {
  // CRITICAL: Never show template names in chat UI
  // Only show actual message content that end users should see

  const isTemplateName = (str) => {
    if (!str || typeof str !== 'string') return false;
    // Check for common template name patterns
    return str.includes('_template') ||
      str.match(/^[a-z_]+_template/i) || // e.g., "testing_template"
      (str.match(/^[A-Za-z_]+$/) && str.length < 50 && str.includes('_')); // Short identifiers with underscores
  };

  const getMessageContent = () => {
    // NEVER show template names - filter them out aggressively
    if (msg.body && typeof msg.body === 'string' && !isTemplateName(msg.body)) {
      return msg.body;
    }

    // Fallback - but never show template names
    return "Template message";
  };

  const getHeaderContent = () => {
    // Check for various possible image fields
    const imageUrl =
      msg.image ||
      msg.headerImage ||
      msg.mediaUrl ||
      msg.template?.image ||
      msg.template?.headerImage;

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.length > 5) { // Ensure it's not a short string/ID
      return (
        <div className="w-full bg-[#f0f2f5] overflow-hidden border-b border-[rgba(0,0,0,0.05)]">
          <img
            src={getImageUrl(imageUrl)}
            alt="Header message"
            className="w-full h-auto max-h-[380px] object-contain object-top block"
            onError={(e) => {
              console.error("Failed to load image:", imageUrl);
              e.target.parentElement.style.display = 'none';
            }}
          />
        </div>
      );
    }

    // Check for text header (only if not template metadata)
    if (msg.header && typeof msg.header === 'string' && !isTemplateName(msg.header)) {
      return msg.header;
    }

    return null;
  };

  const getFooterContent = () => {
    if (msg.footer && typeof msg.footer === 'string' && !isTemplateName(msg.footer)) {
      return msg.footer;
    }

    return null;
  };

  const getButtons = () => {
    const buttons = msg.buttons || msg.template?.buttons || [];

    // Ensure buttons are properly formatted with text property
    return buttons.map((btn, index) => {
      // Handle different button structures
      let text = '';
      if (typeof btn === 'string') {
        text = btn;
      } else if (typeof btn === 'object' && btn !== null) {
        // Extract text from object - handle nested structures
        text = btn.text || btn.title || btn.label || '';
      }

      return {
        text: String(text),
        type: btn?.type || "QUICK_REPLY",
        id: btn?.id || `button_${index}`
      };
    });
  };

  const handleButtonClick = (buttonText, buttonId) => {
    if (onButtonClick) {
      onButtonClick(buttonText, buttonId);
    }
  };

  const isButtonClicked = (buttonId) => {
    if (!clickedButtons || !messageId) return false;
    return clickedButtons.has(`${messageId}-${buttonId}`);
  };

  const messageContent = getMessageContent();
  const headerContent = getHeaderContent();
  const footerContent = getFooterContent();
  const buttons = getButtons();

  return (
    <div
      className={`max-w-[340px] rounded-[10px] p-[8px] pb-[4px] shadow-[0_1px_1px_rgba(0,0,0,0.15)] relative flex flex-col
      ${msg.outgoing ? "bg-[#d9fdd3]" : "bg-white"}`}
    >
      {/* HEADER IMAGE - Padded & Rounded */}
      {headerContent && (
        <div className="mb-[8px] overflow-hidden rounded-[8px]">
          {headerContent}
        </div>
      )}

      {/* TEXT CONTENT CONTAINER - Authentic Spacing */}
      <div className="px-[2px]">
        {/* BODY */}
        <div className="text-[14px] whitespace-pre-line leading-[1.5] text-[#111b21] font-normal [overflow-wrap:anywhere] break-words">
          {messageContent}
        </div>

        {/* FOOTER */}
        {footerContent && (
          <div className="text-[12px] text-[#667781] mt-[6px] font-normal leading-tight">
            {footerContent}
          </div>
        )}

        {/* TIMESTAMP */}
        <div className="flex justify-end items-center gap-1 mt-[2px]">
          <span className="text-[10px] text-black/60 uppercase font-normal">
            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
          </span>
          {msg.outgoing && (
            <div className="flex items-center shrink-0">
              {msg.status === "read" ? (
                <div className="flex items-center">
                  <svg viewBox="0 0 16 15" width="16" height="15" fill="#34b7f1"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-1.122-1.24a.34.34 0 0 0-.499-.017l-.612.58a.374.374 0 0 0-.013.529l1.837 2.046c.5.551 1.413.59 1.958.077l6.759-6.36a.361.361 0 0 0 .046-.51z"></path><path d="M11.077 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.733 9.879a.32.32 0 0 1-.484.033L2.592 8.16a.332.332 0 0 0-.47-.024l-.645.605a.347.347 0 0 0-.016.514l2.212 2.304c.51.533 1.423.574 1.99.09l6.368-6.032a.362.362 0 0 0 .046-.511z"></path></svg>
                </div>
              ) : msg.status === "delivered" ? (
                <div className="flex items-center opacity-60">
                  <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-1.122-1.24a.34.34 0 0 0-.499-.017l-.612.58a.374.374 0 0 0-.013.529l1.837 2.046c.5.551 1.413.59 1.958.077l6.759-6.36a.361.361 0 0 0 .046-.51z"></path><path d="M11.077 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.733 9.879a.32.32 0 0 1-.484.033L2.592 8.16a.332.332 0 0 0-.47-.024l-.645.605a.347.347 0 0 0-.016.514l2.212 2.304c.51.533 1.423.574 1.99.09l6.368-6.032a.362.362 0 0 0 .046-.511z"></path></svg>
                </div>
              ) : msg.status === "failed" ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="#ef4444"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"></path></svg>
              ) : (
                <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor" className="opacity-40"><path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L2.425 8.16a.332.332 0 0 0-.47-.024l-.645.605a.347.347 0 0 0-.016.514l2.212 2.304c.51.533 1.423.574 1.99.09l6.368-6.032a.362.362 0 0 0 .046-.511z"></path></svg>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BUTTONS */}
      {Array.isArray(buttons) && buttons.length > 0 && (
        <div className="mt-1 border-t border-[rgba(0,0,0,0.06)] bg-[rgba(255,255,255,0.1)]">
          {buttons.map((btn, i) => {
            const isClicked = isButtonClicked(btn.id);
            return (
              <button
                key={i}
                onClick={() => !isClicked && handleButtonClick(btn.text, btn.id)}
                disabled={isClicked}
                className={`w-full py-[10px] text-[14px] font-medium transition-colors flex items-center justify-center gap-2 border-b last:border-b-0 border-[rgba(0,0,0,0.06)]
                  ${isClicked
                    ? "text-[#8696A0] cursor-not-allowed"
                    : "text-[#00a884] hover:bg-[rgba(0,0,0,0.04)] active:bg-[rgba(0,0,0,0.08)] cursor-pointer"
                  }`}
              >
                {btn.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
