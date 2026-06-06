import React, { useState, useEffect, useRef } from 'react';

const HtmlEmailEditor = ({ value = "", onChange, placeholder }) => {
  const [html, setHtml] = useState(value);
  const iframeRef = useRef(null);

  // Sync external value
  useEffect(() => {
    setHtml(value || "");
  }, [value]);

  // Update iframe preview when HTML changes
  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // Create HTML document with basic email styling
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              background-color: #ffffff;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            table {
              border-collapse: collapse;
            }
          </style>
        </head>
        <body>
          ${html || '<p style="color: #999; text-align: center;">Start typing HTML code to see preview...</p>'}
        </body>
        </html>
      `;
      
      iframeDoc.open();
      iframeDoc.write(emailHtml);
      iframeDoc.close();
    }
  }, [html]);

  const handleChange = (e) => {
    const newHtml = e.target.value;
    setHtml(newHtml);
    onChange?.(newHtml);
  };

  return (
    <div className="space-y-4">
      {/* HTML Code Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          HTML Code
        </label>
        <textarea
          value={html}
          onChange={handleChange}
          placeholder={placeholder || "Paste your HTML email code here..."}
          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-gray-50"
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '13px',
            lineHeight: '1.4'
          }}
        />
      </div>

      {/* Live Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Live Preview
          </label>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Real-time HTML Render
          </span>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            className="w-full h-64 bg-white"
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Helper Tips */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>💡 HTML Email Tips:</strong>
        </p>
        <ul className="text-xs text-blue-600 mt-1 space-y-1">
          <li>• Use inline styles for better email client compatibility</li>
          <li>• Use tables for layout (best email practice)</li>
          <li>• Include alt text for images</li>
          <li>• Test variables like {"{{name}}"} will be replaced when sending</li>
        </ul>
      </div>
    </div>
  );
};

export default HtmlEmailEditor;
