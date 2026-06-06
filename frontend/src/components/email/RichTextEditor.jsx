import React, { useState, useEffect, useRef } from 'react';

const RichTextEditor = ({ value = "", onChange, placeholder }) => {
  const editorRef = useRef(null);
  const [html, setHtml] = useState(value);

  // Sync external value safely
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
    setHtml(value || "");
  }, [value]);

  const emitChange = () => {
    const content = editorRef.current.innerHTML;
    setHtml(content);
    onChange?.(content);
  };

  const format = (cmd, val = null) => {
    editorRef.current.focus();
    document.execCommand(cmd, false, val);
    emitChange();
  };

  const insertVariable = (text) => {
    editorRef.current.focus();
    document.execCommand("insertText", false, text);
    emitChange();
  };

  const insertLink = () => {
    const url = prompt("Enter URL");
    if (url) format("createLink", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b p-2 bg-gray-50">
        <button onClick={() => format("bold")} className="rte-btn"><b>B</b></button>
        <button onClick={() => format("italic")} className="rte-btn"><i>I</i></button>
        <button onClick={() => format("underline")} className="rte-btn"><u>U</u></button>
        <button onClick={() => format("insertUnorderedList")} className="rte-btn">• List</button>
        <button onClick={() => format("insertOrderedList")} className="rte-btn">1. List</button>
        <button onClick={insertLink} className="rte-btn">🔗 Link</button>
      </div>

      {/* Variables */}
      <div className="flex gap-2 p-2 bg-blue-50 border-b text-xs">
        {["name", "email", "company", "date"].map(v => (
          <button
            key={v}
            onClick={() => insertVariable(`{{${v}}}`)}
            className="px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        className="p-4 min-h-[280px] outline-none"
        style={{
          direction: "ltr",
          unicodeBidi: "plaintext",
          textAlign: "left",
        }}
        data-placeholder={placeholder}
      />

      {/* Live Preview */}
      <div className="border-t bg-gray-50 p-4">
        <div className="text-xs font-semibold mb-2">Live Preview</div>
        <div
          className="bg-white border rounded p-3 text-sm"
          style={{
            direction: "ltr",
            unicodeBidi: "plaintext",
            textAlign: "left",
          }}
          dangerouslySetInnerHTML={{
            __html: html || `<span class="text-gray-400">${placeholder || "Nothing to preview"}</span>`,
          }}
        />
      </div>

      {/* Tiny CSS */}
      <style>
        {`
          .rte-btn {
            padding: 4px 8px;
            font-size: 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: white;
          }
          .rte-btn:hover {
            background: #f3f4f6;
          }
          [contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
          }
        `}
      </style>
    </div>
  );
};

export default RichTextEditor;
