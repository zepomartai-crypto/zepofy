// src/pages/automation/FlowBuilder.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeToolbar,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FiPlay, FiMessageSquare, FiImage, FiClock, FiGitBranch, FiSettings, FiPlus, FiEdit, FiCopy, FiTrash2, FiX, FiArrowLeft, FiCheck, FiChevronRight, FiMove, FiZap, FiTarget, FiGrid, FiAlertTriangle, FiCreditCard, FiLink, FiMaximize, FiPhone, FiExternalLink, FiLayers } from "react-icons/fi";
import dagre from 'dagre';
import api from "../../api/api";
import nicePrompt from "../../components/UI/NicePrompt";
import { useIntegration } from "../../context/IntegrationContext";

const API_BASE = import.meta.env.VITE_SERVER_URL;

// Node Types - Streamlined for a perfect professional experience
const NODE_TYPES = [
  { type: 'trigger', label: 'Flow Start', icon: FiPlay, color: 'emerald' },
  { type: 'text', label: 'Text + Buttons', icon: FiMessageSquare, color: 'blue' },
  { type: 'media', label: 'Media Input', icon: FiImage, color: 'blue' },
  { type: 'template', label: 'Template', icon: FiCheck, color: 'indigo' },
  { type: 'system_template', label: 'System Template', icon: FiMessageSquare, color: 'sky' },
  { type: 'delay', label: 'Delay', icon: FiClock, color: 'amber' },
  { type: 'intervention', label: 'Human Agent', icon: FiSettings, color: 'slate' },
  { type: 'user_input', label: 'User Input', icon: FiTarget, color: 'violet' },
  { type: 'interactive_list', label: 'Interactive Menu', icon: FiGrid, color: 'purple' },
  { type: 'action', label: 'Action Node', icon: FiZap, color: 'rose' },
  { type: 'payment', label: 'Payment Node', icon: FiCreditCard, color: 'indigo' },
  { type: 'whatsapp_flow', label: 'WhatsApp Flow', icon: FiLayers, color: 'blue' },
];

// Safe render helper to catch object rendering issues
const safeRender = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return value.toString();
  if (typeof value === 'object') {
    return value.text || value.value || value.label || value.type || fallback;
  }
  return fallback;
};

// Helper to replace variables in template preview with premium rendering
const replaceVariables = (text, variables) => {
  if (!text) return '';
  if (!variables) return text;

  const parts = text.split(/(\{\{\d+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/\{\{(\d+)\}\}/);
    if (match) {
      const num = match[1];
      const val = variables[num] || part;

      let display = val;
      let isSystem = true;
      if (val === '{{customer_name}}') display = '[Name]';
      else if (val === '{{customer_phone}}') display = '[Phone]';
      else if (val === '{{order_id}}') display = '[Order ID]';
      else if (val === '{{amount}}') display = '[Total]';
      else if (val === '{{tracking_link}}') display = '[Track]';
      else if (val === '{{checkout_url}}') display = '[Checkout]';
      else if (val === '{{invoice_url}}') display = '[Invoice]';
      else isSystem = false;

      if (isSystem) {
        return <span key={i} className="text-teal-600 font-bold px-1.5 py-0.5 bg-teal-50/50 rounded-lg border border-teal-100 mx-0.5 text-[11px] inline-flex items-center shadow-sm">{display}</span>;
      }
      return <span key={i} className="text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded-md border border-emerald-100 mx-0.5 text-[11px]">{val}</span>;
    }
    return part;
  });
};

const SYSTEM_VARIABLES = [
  { label: 'Recipient Name', value: '{{customer_name}}' },
  { label: 'Recipient Phone', value: '{{customer_phone}}' },
  { label: 'Order ID / Number', value: '{{order_id}}' },
  { label: 'Order Total', value: '{{amount}}' },
  { label: 'Tracking Link', value: '{{tracking_link}}' },
  { label: 'Checkout URL', value: '{{checkout_url}}' },
  { label: 'Invoice URL', value: '{{invoice_url}}' },
  { label: 'Order Items (List)', value: '{{order_items}}' },
  { label: 'Order Date', value: '{{order_date}}' },
];

// Custom Node Component
const CustomNode = ({ id, data, selected }) => {
  const [showControls, setShowControls] = useState(false);

  const nodeInfo = NODE_TYPES.find(n => n.type === data.type) || { color: 'blue', label: 'Node' };
  const themeColor = data.type === 'template' ? 'emerald' : data.type === 'action' ? 'rose' : nodeInfo.color;

  const getHeaderStyle = () => {
    switch (themeColor) {
      case 'emerald': return 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-transparent';
      case 'blue': return 'bg-gradient-to-r from-blue-700 to-blue-600 text-white border-transparent';
      case 'sky': return 'bg-gradient-to-r from-sky-600 to-sky-500 text-white border-transparent';
      case 'cyan': return 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white border-transparent';
      case 'indigo': return 'bg-gradient-to-r from-indigo-700 to-indigo-600 text-white border-transparent';
      case 'purple': return 'bg-gradient-to-r from-purple-700 to-purple-600 text-white border-transparent';
      case 'rose': return 'bg-gradient-to-r from-rose-600 to-rose-500 text-white border-transparent';
      default: return 'bg-gradient-to-r from-slate-700 to-slate-600 text-white border-transparent';
    }
  };

  const getIconColor = () => 'text-white/90';

  const renderNodeContent = () => {
    switch (data.type) {
      case 'trigger':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] ${['keyword', 'instagram_message', 'instagram_comment', 'facebook_message'].includes(data.triggerType) && (!data.keywords || data.keywords.length === 0) ? 'bg-amber-500 animate-bounce' : 'bg-blue-500 animate-pulse'}`} />
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest leading-none mb-1">Flow Trigger</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-blue-900">
                    {data.triggerType === 'keyword' ? 'Keyword Matching' :
                      data.triggerType === 'campaign' ? 'Campaign Reply' :
                        data.triggerType === 'contact' ? 'New Contact' :
                          data.triggerType === 'order_created' ? 'Order Created' :
                            data.triggerType === 'woocommerce' ? 'WooCommerce Order' :
                              data.triggerType === 'shopify' ? 'Shopify Order' :
                                safeRender(data.triggerType, 'Keyword matching')}
                  </span>
                  {['keyword', 'instagram_message', 'instagram_comment', 'facebook_message'].includes(data.triggerType) && (!data.keywords || data.keywords.length === 0) && (
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md font-black animate-pulse uppercase tracking-tight">CATCH-ALL (Any message)</span>
                  )}
                </div>
              </div>
            </div>

            {['keyword', 'instagram_message', 'instagram_comment', 'facebook_message'].includes(data.triggerType) && (
              <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 min-h-[40px] items-center justify-center">
                {data.keywords && data.keywords.length > 0 ? (
                  data.keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 bg-white border border-blue-100 text-blue-600 text-[10px] font-bold rounded-lg shadow-sm">
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">Runs on any inbound text</span>
                )}
              </div>
            )}

            {data.triggerType === 'campaign' && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2">
                <FiTarget className="text-indigo-500" size={14} />
                <span className="text-[10px] font-bold text-indigo-700 truncate">Target Campaign Set</span>
              </div>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3">
            <div className="text-[13px] text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-medium whitespace-pre-wrap">
              {safeRender(data.text, 'Type your message here...')}
            </div>
            {data.buttons && data.buttons.length > 0 && (
              <div className="space-y-2 pt-1">
                {data.buttons.map((btn, i) => {
                  const isObj = typeof btn === 'object';
                  const type = isObj ? (btn.type || '').toLowerCase() : '';
                  const label = isObj ? btn.text : btn;
                  const value = isObj ? (btn.url || btn.link || btn.value) : '';
                  const isAction = type === 'url' || type === 'website' || (typeof value === 'string' && value.startsWith('http'));
                  const isReply = !isAction;

                  return (
                    <div key={i} className="relative group/btn">
                      <div className={`w-full py-2.5 px-4 bg-white border ${isAction ? 'border-blue-300 bg-blue-50/20' : 'border-blue-200'} text-blue-600 rounded-xl text-[12px] font-semibold shadow-sm group-hover/btn:border-blue-400 group-hover/btn:bg-blue-50 transition-all flex flex-col items-center justify-center gap-0.5`}>
                        <div className="flex items-center gap-2">
                          {type === 'url' && <FiLink size={12} className="opacity-70" />}
                          {label || 'Button'}
                        </div>
                        {isAction && value && <div className="text-[8px] opacity-50 truncate max-w-[150px] font-medium">{value}</div>}
                      </div>
                      {isReply && (
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`btn-${i}`}
                          className="!w-6 !h-6 !bg-blue-600 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'user_input':
        const routes = data.keywordRoutes || [];
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl relative shadow-none">
              <div className="w-9 h-9 bg-violet-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                <FiMessageSquare size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest leading-none mb-1">Wait for Input</div>
                <div className="text-[12px] font-semibold text-violet-900 leading-tight">Variable: <span className="text-violet-500 underline decoration-2 underline-offset-2">{"{{ " + (data.variableName || 'user_reply') + " }}"}</span></div>
              </div>

              {/* Handle for Free Text Mode or Single Output */}
              {data.routingMode !== 'keyword' && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id="default"
                  className="!w-4 !h-4 !bg-violet-500 !border-2 !border-white !-right-6 transition-all hover:scale-125 shadow-md"
                />
              )}
            </div>

            {data.routingMode === 'keyword' ? (
              <div className="space-y-2 mt-2 px-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-loose mb-1">Keyword Branches</div>
                {routes.map((route, i) => (
                  <div key={i} className="group relative">
                    <div className="py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-[12px] font-semibold shadow-sm transition-all group-hover:border-violet-300 group-hover:bg-violet-50/30">
                      {route.keyword || `Keyword ${i + 1}`}
                    </div>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`kw-${i}`}
                      className="!w-6 !h-6 !bg-emerald-500 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                    />
                  </div>
                ))}

                {/* Fallback Handle */}
                <div className="group relative mt-4 pt-4 border-t border-slate-100">
                  <div className="py-2.5 px-4 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[11px] font-semibold shadow-sm italic text-center">
                    No matching keyword
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
                    className="!w-6 !h-6 !bg-slate-400 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/40 border-2 border-dashed border-violet-100 rounded-xl">
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold italic opacity-60 text-center">Any reply continues flow...</p>
              </div>
            )}
          </div>
        );

      case 'media':
        return (
          <div className="space-y-3">
            <div className="media-container !h-[200px] !bg-slate-100">
              {data.imageUrl || data.url ? (
                <img src={data.imageUrl || data.url} alt="Media" className="!object-contain" />
              ) : (
                <div className="flex flex-col items-center opacity-20 text-slate-400">
                  <FiImage size={32} />
                  <span className="text-[10px] font-semibold mt-2 uppercase tracking-widest">Media Preview</span>
                </div>
              )}
            </div>
            {data.text && (
              <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <p className="text-[12px] text-slate-600 leading-relaxed italic whitespace-pre-wrap">{safeRender(data.text)}</p>
              </div>
            )}
            {(data.buttons && data.buttons.length > 0) && (
              <div className="space-y-2 pt-1 px-4 pb-4">
                {data.buttons.map((btn, i) => {
                  const isObj = typeof btn === 'object';
                  const type = isObj ? (btn.type || '').toLowerCase() : '';
                  const label = isObj ? btn.text : btn;
                  const value = isObj ? (btn.url || btn.link || btn.value) : '';
                  const isAction = type === 'url' || type === 'website' || (typeof value === 'string' && value.startsWith('http'));
                  const isReply = !isAction;

                  return (
                    <div key={i} className="relative group/btn mt-2">
                      <div className={`w-full py-2.5 px-4 bg-white border ${isAction ? 'border-blue-300 bg-blue-50/20' : 'border-blue-200'} text-blue-600 rounded-xl text-[12px] font-semibold shadow-sm group-hover/btn:border-blue-400 group-hover/btn:bg-blue-50 transition-all flex flex-col items-center justify-center gap-0.5`}>
                        <div className="flex items-center gap-2">
                          {type === 'url' && <FiLink size={12} className="opacity-70" />}
                          {label || 'Button'}
                        </div>
                        {isAction && value && <div className="text-[8px] opacity-50 truncate max-w-[150px] font-medium">{value}</div>}
                      </div>
                      {isReply && (
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`btn-${i}`}
                          className="!w-6 !h-6 !bg-blue-600 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'interactive_list':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
              <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest">List Message</div>
              <div className="text-[13px] font-bold text-slate-900 leading-tight">
                {safeRender(data.bodyText || data.text, 'Select an option...')}
              </div>
              <div className="py-2 px-3 bg-white rounded-xl border border-purple-200 text-purple-600 text-[11px] font-black text-center shadow-sm">
                ☰ {safeRender(data.buttonText, 'View Menu')}
              </div>
            </div>

            <div className="space-y-4 px-1">
              {(data.sections || []).map((section, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">{section.title || "Section"}</div>
                  {(section.rows || []).map((row, rIdx) => (
                    <div key={rIdx} className="relative group">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm group-hover:border-purple-300 group-hover:bg-purple-50/30 transition-all">
                        <div className="text-[12px] font-bold text-slate-800">{row.title || "Option"}</div>
                        {row.description && <div className="text-[10px] text-slate-400 font-medium truncate">{row.description}</div>}
                      </div>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={row.id || `row-${sIdx}-${rIdx}`}
                        className="!w-6 !h-6 !bg-purple-600 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case 'action':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl relative shadow-none">
              <div className="w-9 h-9 bg-rose-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                <FiZap size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest leading-none mb-1">System Action</div>
                <div className="text-[12px] font-bold text-rose-900 leading-tight">
                  {data.actionType === 'cancel_order' ? 'Cancel Order' :
                    data.actionType === 'confirm_order' ? 'Confirm Order' :
                      data.actionType === 'mark_paid' ? 'Mark Paid' :
                        data.actionType === 'send_invoice' ? 'Send Invoice' :
                          data.actionType === 'track_order' ? 'Track Order' :
                            'No Action Selected'}
                </div>
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                className="!w-6 !h-6 !bg-rose-600 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
              />
            </div>
          </div>
        );

      case 'single_product':
        return (
          <div className="space-y-3">
            <div className="group/card relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="aspect-video bg-white flex items-center justify-center relative">
                {data.imageUrl ? (
                  <img src={data.imageUrl} className="w-full h-full object-cover" alt="Product" />
                ) : (
                  <div className="flex flex-col items-center opacity-20">
                    <FiImage size={32} />
                    <span className="text-[10px] font-bold mt-2">NO IMAGE</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
                  <span className="text-[11px] font-semibold text-sky-600">{data.currency || '₹'}{data.price || '0.00'}</span>
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-[12px] font-semibold text-slate-800 truncate">{safeRender(data.productTitle, 'Product Name')}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-normal">{safeRender(data.description, 'Sample product description goes here...')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="w-full text-center py-2 px-3 bg-white border border-sky-100 text-sky-600 rounded-xl text-[11px] font-semibold">
                View Details
              </div>
              <div className="w-full text-center py-2 px-3 bg-sky-600 text-white rounded-xl text-[11px] font-semibold">
                Check Out
              </div>
            </div>
          </div>
        );

      case 'multi_product':
        return (
          <div className="space-y-4">
            <div className="bg-cyan-50/30 p-2 rounded-xl border border-cyan-100/50">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-semibold text-cyan-700 uppercase tracking-widest">Product Catalog</span>
                <span className="text-[9px] font-medium text-cyan-500 bg-white px-1.5 py-0.5 rounded-full border border-cyan-50">{data.products?.length || 0} Items</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((idx) => {
                  const product = data.products?.[idx];
                  return (
                    <div key={idx} className="bg-white rounded-lg border border-cyan-100 p-1.5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                      <div className="aspect-square bg-slate-50 rounded italic mb-1.5 flex items-center justify-center overflow-hidden">
                        {product?.image ? <img src={product.image} className="w-full h-full object-cover" /> : <FiImage size={12} className="opacity-20" />}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-700 truncate line-clamp-1">{product?.title || 'Product'}</div>
                      <div className="text-[8px] font-semibold text-cyan-600 mt-0.5">{data.currency || '₹'}{product?.price || '0'}</div>
                    </div>
                  );
                })}
              </div>
              {data.products?.length > 2 && (
                <div className="text-center mt-2 p-1.5 bg-white/50 rounded-lg text-[9px] font-semibold text-cyan-600 border border-dashed border-cyan-200">
                  + {data.products.length - 2} More Products
                </div>
              )}
            </div>
            <div className="relative group/btn">
              <div className="w-full text-center py-2.5 px-4 bg-white border border-cyan-200 text-cyan-600 rounded-xl text-[12px] font-semibold shadow-sm transition-all">
                VIEW CATALOG
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="catalog-link"
                className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white !-right-6 shadow-sm"
              />
            </div>
          </div>
        );

      case 'template':
        const header = data.templatePreview?.header;
        const headerImage = typeof header === 'object' && (header.format?.toUpperCase() === 'IMAGE' || header.type?.toUpperCase() === 'IMAGE') ? (header.imageUrl || header.url) : null;
        const headerText = typeof header === 'object' ? header.text : (typeof header === 'string' ? header : null);

        return (
          <div className="space-y-3">
            {data.templatePreview ? (
              <div className="wa-template-bubble rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg group-hover/node:shadow-xl transition-all duration-300">
                {/* Header Image */}
                {(data.headerImageUrl || headerImage || (header && (header.format?.toUpperCase() === 'IMAGE' || header.type?.toUpperCase() === 'IMAGE'))) && (
                  <div className="w-full aspect-[16/10] bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 relative group/img">
                    {(data.headerImageUrl || headerImage) ? (
                      <img
                        src={data.headerImageUrl || headerImage}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/node:scale-110"
                        alt="Header"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <FiImage size={32} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Image Header</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors" />
                  </div>
                )}

                {/* Content Body */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Official Template</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[150px]">{data.templateName}</span>
                  </div>

                  {headerText && (
                    <div className="text-[14px] font-bold text-slate-900 leading-snug border-b border-slate-50 pb-2 mb-2">
                      {replaceVariables(headerText, data.variables)}
                    </div>
                  )}

                  <div className="text-[14px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {replaceVariables(data.templatePreview.body, data.variables)}
                  </div>

                  {data.templatePreview.footer && (
                    <div className="text-[11px] text-slate-400 mt-2 font-medium italic border-t border-slate-50 pt-2 whitespace-pre-wrap">
                      {replaceVariables(data.templatePreview.footer, data.variables)}
                    </div>
                  )}
                </div>

                {/* Buttons Section */}
                {data.templatePreview.buttons && data.templatePreview.buttons.length > 0 && (
                  <div className="wa-buttons-list bg-slate-50/80 p-1.5 space-y-1.5 border-t border-slate-100">
                    {data.templatePreview.buttons.map((btn, i) => (
                      <div key={i} className="relative group/btn px-1.5">
                        <div className="w-full py-3 px-4 bg-white border border-slate-200 text-emerald-600 rounded-2xl text-[13px] font-bold shadow-sm text-center group-hover/btn:border-emerald-400 group-hover/btn:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                          {(typeof btn === 'object' && (btn.type === 'PHONE_NUMBER' || btn.actionType === 'phone')) && <FiPhone size={14} className="opacity-60" />}
                          {(typeof btn === 'object' && (btn.type === 'URL' || btn.actionType === 'url')) && <FiExternalLink size={14} className="opacity-60" />}
                          {typeof btn === 'string' ? btn : (btn.text || btn.label || 'Button')}
                        </div>
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`btn-${i}`}
                          className="!w-6 !h-6 !bg-emerald-600 !border-2 !border-white !-right-9 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[12px] text-slate-400 p-10 border-2 border-dashed border-slate-200 rounded-[32px] text-center italic font-semibold bg-slate-50/50 flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                  <FiCheck size={24} />
                </div>
                Select a template to preview
              </div>
            )}
          </div>
        );

      case 'delay':
        return (
          <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <FiClock size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest leading-none mb-1">Wait Time</span>
              <div className="text-[12px] font-semibold text-amber-900">
                {safeRender(data.delay, '5')} {safeRender(data.delayUnit, 'minutes')}
              </div>
            </div>
          </div>
        );

      case 'system_template':
        // Use text/message fallback for rendering
        const displayMessage = data.text || data.message || (data.template?.message) || 'Choose a system template...';
        const displayButtons = data.buttons || (data.template?.buttons) || [];
        const displayImage = data.imageUrl || (data.template?.imageUrl);

        return (
          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-sky-600 uppercase tracking-widest px-1">Internal Template</div>

            {displayImage && (
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-video flex items-center justify-center">
                <img src={displayImage} alt="Template Media" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="text-[13px] text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-medium">
              {safeRender(displayMessage)}
            </div>

            {displayButtons.length > 0 && (
              <div className="space-y-2 pt-1">
                {displayButtons.map((btn, i) => (
                  <div key={i} className="relative group/btn mt-2">
                    <div className="w-full text-center py-2.5 px-4 bg-white border border-sky-200 text-sky-600 rounded-xl text-[12px] font-semibold shadow-sm group-hover/btn:border-sky-400 transition-all">
                      {btn.label || 'Button'}
                    </div>
                    {btn.actionType !== 'url' && (
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`btn-${i}`}
                        className="!w-4 !h-4 !bg-sky-500 !border-2 !border-white !-right-7 transition-all hover:scale-125 shadow-md flex items-center justify-center"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-3">
            <div className="text-[12px] font-semibold text-slate-700 px-3 py-2 bg-purple-50/50 rounded-lg border border-purple-100">
              {safeRender(data.condition, 'Check user response...')}
            </div>
            {data.options && data.options.length > 0 && (
              <div className="space-y-2 pt-1">
                {data.options.map((opt, i) => (
                  <div key={i} className="relative group/opt">
                    <div className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-purple-200 text-purple-700 rounded-xl text-[12px] font-semibold shadow-sm transition-all group-hover/opt:bg-purple-50">
                      <span>{typeof opt === 'string' ? opt : (opt.text || 'Option')}</span>
                      <FiChevronRight size={14} className="opacity-40" />
                    </div>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`opt-${i}`}
                      className="!w-6 !h-6 !bg-purple-500 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'intervention':
        return (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
              <FiSettings size={18} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none mb-1">Action</span>
              <span className="text-[12px] font-semibold text-slate-800">Support Intervention</span>
            </div>
          </div>
        );

      case 'list':
        return (
          <div className="space-y-3">
            <div className="text-[13px] text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 font-semibold">
              {safeRender(data.listTitle, 'List Menu')}
            </div>
            {data.options && data.options.length > 0 ? (
              <div className="space-y-2 pt-1">
                {data.options.map((opt, i) => {
                  const title = typeof opt === 'object' ? opt.title : opt;
                  const desc = typeof opt === 'object' ? opt.description : '';
                  return (
                    <div key={i} className="relative group/opt">
                      <div className="w-full flex flex-col justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm transition-all group-hover/opt:border-blue-300 group-hover/opt:bg-blue-50/20 group-hover/opt:text-blue-700">
                        <span className="text-[12px] font-semibold truncate">{title || `Item ${i + 1}`}</span>
                        {desc && <span className="text-[10px] text-slate-400 font-medium truncate">{desc}</span>}
                      </div>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`opt-${i}`}
                        className="!w-6 !h-6 !bg-blue-400 !border-2 !border-white !-right-8 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5 opacity-60">
                <div className="w-full p-2 bg-slate-50 border border-slate-100/50 rounded-lg text-[10px] font-semibold text-slate-400 text-center uppercase tracking-widest border-dashed">No interactive items</div>
              </div>
            )}
          </div>
        );

      case 'api':
        return (
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-cyan-700 p-3 bg-cyan-50 rounded-xl border border-cyan-100 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-cyan-200/50 rounded text-[10px] uppercase">{safeRender(data.method, 'GET')}</span>
              <span className="truncate">{safeRender(data.url, 'https://api...')}</span>
            </div>
          </div>
        );

      case 'tag':
        return (
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-emerald-700 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="block text-[10px] uppercase text-emerald-400 mb-1">Action</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${data.actionType === 'remove' ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                {data.actionType === 'remove' ? 'Remove Tag' : 'Add Tag'}: {safeRender(data.tagName, 'Select Tag')}
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-sm">
                {data.paymentType === 'qr' ? <FiMaximize size={18} /> : <FiLink size={18} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">
                  {data.paymentType === 'qr' ? 'QR Code Payment' : 'Link Payment'}
                </span>
                <span className="text-[12px] font-semibold text-indigo-900 truncate max-w-[200px]">{safeRender(data.bodyText, 'Click to pay')}</span>
              </div>
            </div>
            {data.paymentType === 'qr' && data.qrCodeUrl && (
              <div className="aspect-square bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center p-4">
                <img src={data.qrCodeUrl} className="w-full h-full object-contain" alt="QR Code" />
              </div>
            )}
            {data.paymentType === 'link' && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-500 truncate">
                {safeRender(data.paymentLink, 'https://pay.link/...')}
              </div>
            )}
          </div>
        );

      case 'whatsapp_flow':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-sm">
                <FiLayers size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                  WhatsApp Flow
                </span>
                <span className="text-[12px] font-semibold text-blue-900 truncate max-w-[200px]">{safeRender(data.flowName, 'Select Flow')}</span>
              </div>
            </div>
            <div className="text-[13px] text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 font-semibold leading-relaxed">
              {safeRender(data.bodyText, 'Please fill out this form:')}
            </div>
            <div className="w-full text-center py-2.5 px-4 bg-white border border-blue-200 text-blue-600 rounded-xl text-[12px] font-bold shadow-sm">
              {safeRender(data.buttonText, 'Open Form')}
            </div>
          </div>
        );

      default:
        return (
          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            <span className="text-[12px] font-semibold text-slate-400">{safeRender(data.label, 'Unknown Node')}</span>
          </div>
        );
    }
  };

  return (
    <>
      <div
        className={`relative bg-white border rounded-[20px] shadow-[0px_8px_40px_rgba(0,0,0,0.06)] transition-all w-[320px] group/node overflow-hidden ${selected ? 'ring-[3px] ring-blue-500/20 border-blue-500' : 'border-[#e0e4e9]'}`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Connection Handles - MAIN INPUT */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-6 !h-6 !bg-blue-500 !border-2 !border-white !-top-3 transition-all hover:scale-125 shadow-lg cursor-crosshair z-[100] flex items-center justify-center after:content-['+'] after:text-white after:text-[14px] after:font-bold"
        />

        {/* Node Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${getHeaderStyle()}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white/20 backdrop-blur-md ${getIconColor()}`}>
              {React.createElement(nodeInfo.icon || FiSettings, { size: 16, strokeWidth: 1.5 })}
            </div>
            <span className="text-[12px] font-semibold tracking-wider uppercase">
              {data.type === 'text' ? 'Message' : nodeInfo.label}
            </span>
          </div>

          {showControls && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200 bg-white/80 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border border-white/50">
              <FiEdit
                size={14}
                className="text-slate-500 hover:text-blue-600 cursor-pointer transition-all hover:scale-120"
                title="Edit Details"
                onClick={(e) => { e.stopPropagation(); data.onEdit?.(e); }}
              />
              <FiCopy
                size={14}
                className="text-slate-500 hover:text-indigo-600 cursor-pointer transition-all hover:scale-120"
                title="Duplicate"
                onClick={(e) => { e.stopPropagation(); data.onDuplicate?.(e); }}
              />
              <FiLink
                size={14}
                className="text-slate-500 hover:text-amber-600 cursor-pointer transition-all hover:scale-120 rotate-45"
                title="Disconnect All"
                onClick={(e) => { e.stopPropagation(); data.onDisconnect?.(e); }}
              />
              <div className="w-px h-3 bg-slate-300 mx-0.5" />
              <FiTrash2
                size={14}
                className="text-slate-500 hover:text-red-500 cursor-pointer transition-all hover:scale-120"
                title="Delete Step"
                onClick={(e) => { e.stopPropagation(); data.onDelete?.(e); }}
              />
            </div>
          )}
        </div>

        {/* Node Content */}
        <div className="p-4 bg-white">
          {renderNodeContent()}
        </div>

        {/* Footer Link / Handle */}
        {(!data.buttons || data.buttons.length === 0) && data.type !== 'multi_product' && data.type !== 'action' && (
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Default Flow</span>
            <Handle
              type="source"
              position={Position.Bottom}
              className="!relative !w-6 !h-6 !bg-slate-800/20 !border-2 !border-white !inset-0 !m-0 hover:scale-125 transition-all cursor-crosshair z-[100] shadow-md flex items-center justify-center after:content-['+'] after:text-slate-600 after:text-[14px] after:font-bold"
            />
          </div>
        )}
      </div>
      {selected && (
        <NodeToolbar position={Position.Right} offset={12}>
          <div className="flex flex-col gap-1.5 bg-white border border-slate-200 rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-2 min-w-[160px] animate-in slide-in-from-left-2 duration-300">
            <button
              className="p-2.5 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[12px] font-semibold flex items-center gap-3 w-full text-left transition-all"
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit?.(e);
              }}
            >
              <FiEdit size={16} className="text-blue-500" /> Edit Details
            </button>
            <button
              className="p-2.5 hover:bg-slate-50 hover:text-slate-700 rounded-lg text-[12px] font-semibold flex items-center gap-3 w-full text-left transition-all"
              onClick={(e) => {
                e.stopPropagation();
                data.onDuplicate?.(e);
              }}
            >
              <FiCopy size={16} className="text-slate-400" /> Duplicate
            </button>
            <button
              className="p-2.5 hover:bg-slate-50 hover:text-blue-600 rounded-lg text-[12px] font-semibold flex items-center gap-3 w-full text-left transition-all"
              onClick={(e) => {
                e.stopPropagation();
                data.onDisconnect?.(e);
              }}
            >
              <FiLink size={16} className="text-blue-400 rotate-45" /> Disconnect All
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              className="p-2.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-[12px] font-semibold flex items-center gap-3 w-full text-left transition-all"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(e);
              }}
            >
              <FiTrash2 size={16} className="text-red-400" /> Delete Step
            </button>
          </div>
        </NodeToolbar>
      )}
    </>
  );
};

// Node types for React Flow - MAP ALL TYPES TO CUSTOM NODE
const reactFlowNodeTypes = {
  custom: CustomNode,
  text: CustomNode,
  trigger: CustomNode,
  template: CustomNode,
  delay: CustomNode,
  condition: CustomNode,
  action: CustomNode,
  media: CustomNode,
  list: CustomNode,
  single_product: CustomNode,
  multi_product: CustomNode,
  intervention: CustomNode,
  user_input: CustomNode,
  api: CustomNode,
  tag: CustomNode,
  system_template: CustomNode,
};

// --- Dagre Auto-Layout Engine ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 340;
const nodeHeight = 280;

const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 150, // Increase horizontal padding
    ranksep: 200, // Increase vertical padding
    align: 'DL' // Down-Left alignment for a cleaner look
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.targetPosition = isHorizontal ? Position.Left : Position.Top;
      node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      // We are shifting the dagre node position (center) to the top left position (react flow)
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };

      return node;
    }),
    edges,
  };
};

function FlowBuilder() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const { whatsappCommerceConnected, wooConnected, shopifyConnected, facebookInstagramConnected } = useIntegration();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [systemTemplates, setSystemTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [triggerOptions, setTriggerOptions] = useState([]);
  const [savedFlow, setSavedFlow] = useState(null);
  const [whatsappFlows, setWhatsappFlows] = useState([]);

  // Keyword Modal State
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [keywordConflicts, setKeywordConflicts] = useState([]); // Array of { keyword, flowName }
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [headerOverrideTab, setHeaderOverrideTab] = useState('url'); // 'url' | 'upload'
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Auto-open right panel when a node is selected
  useEffect(() => {
    if (selectedNode) {
      setIsRightPanelOpen(true);
    }
  }, [selectedNode?.id]);
  useEffect(() => {
    const isEdit = flowId && flowId !== 'new';
    console.log('🔧 FlowBuilder initialized:', {
      mode: isEdit ? 'EDIT' : 'CREATE',
      flowId,
      savedFlowName: savedFlow?.name || 'not loaded'
    });
  }, [flowId, savedFlow?.name]);

  // ✅ Initial load of necessary data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Fetch Templates
        const tRes = await api.get('/templates');
        if (tRes.data.success) setTemplates(tRes.data.templates || []);

        // Fetch System Templates
        const stRes = await api.get('/system-templates');
        setSystemTemplates(stRes.data || []);

        // Fetch Campaigns
        const cRes = await api.get('/campaigns');
        if (cRes.data.success) setCampaigns(cRes.data.campaigns || []);

        // Fetch Trigger Options
        const trRes = await api.get('/flows/triggers');
        if (trRes.data.success) setTriggerOptions(trRes.data.triggers || []);
        
        // Fetch WhatsApp Flows
        try {
          const flowRes = await api.get('/whatsapp-flows');
          if (flowRes.data.success) {
            const fetchedFlows = flowRes.data.data || flowRes.data.flows || [];
            setWhatsappFlows(fetchedFlows.filter(f => f.status === 'PUBLISHED' || f.status === 'APPROVED'));
          }
        } catch (flowErr) {
          console.error("Failed to load WhatsApp flows:", flowErr);
        }
      } catch (err) {
        console.error("Initial load failed:", err);
      }
    };
    loadInitialData();
  }, []);

  // Load flow data
  useEffect(() => {
    if (flowId && flowId !== 'new') {
      loadFlow();
    }
  }, [flowId]);

  const loadFlow = async () => {
    if (!flowId || flowId === 'new') return;
    try {
      console.log(`📥 Loading flow with ID: ${flowId}`);
      const res = await api.get(`/flows/${flowId}`);
      const flow = res.data.flow;

      console.log('✅ Flow loaded:', {
        flowId: flow?._id,
        name: flow?.name,
        nodeCount: flow?.nodes?.length || 0,
        edgeCount: flow?.connections?.length || 0
      });

      if (flow?.nodes) {
        setNodes(flow.nodes.map(node => ({
          ...node,
          type: 'custom',
          data: { ...node.data, type: node.data?.type || node.type }
        })));
      }
      if (flow?.connections) {
        setEdges(flow.connections);
      }
      setSavedFlow(flow);
    } catch (err) {
      console.error("❌ Failed to load flow", err);
    }
  };

  const loadTemplates = async () => {
    try {
      // ✅ PRIORITY 1: Load from Local DB for instant selection
      const res = await api.get('/templates');
      const localTemplates = res.data.templates || [];
      setTemplates(localTemplates);

      // ✅ PRIORITY 2: Background sync with Meta to update statuses/fetch new
      // We don't block the UI for this, it just updates the list if successful
      api.get('/templates/sync/meta').then(syncRes => {
        if (syncRes.data.success && syncRes.data.templates) {
          setTemplates(syncRes.data.templates);
        }
      }).catch(err => console.log("Background sync failed (Silent):", err));

    } catch (err) {
      console.error("Failed to load templates", err);
    }
    
    try {
      // ✅ PRIORITY 3: Load WhatsApp Flows
      const flowRes = await api.get('/whatsapp-flows');
      if (flowRes.data.success) {
        const fetchedFlows = flowRes.data.data || flowRes.data.flows || [];
        setWhatsappFlows(fetchedFlows.filter(f => f.status === 'PUBLISHED' || f.status === 'APPROVED'));
      }
    } catch (err) {
      console.error("Failed to load WhatsApp flows:", err);
    }
  };

  const handleMediaUpload = async (file) => {
    if (!selectedNode || (selectedNode.data.type !== 'media' && selectedNode.data.type !== 'template' && selectedNode.data.type !== 'payment')) return;
    try {
      setIsUploadingMedia(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        if (selectedNode.data.type === 'template') {
          updateNode(selectedNode.id, { headerImageUrl: res.data.url });
        } else if (selectedNode.data.type === 'payment') {
          updateNode(selectedNode.id, { qrCodeUrl: res.data.url });
        } else {
          updateNode(selectedNode.id, {
            imageUrl: res.data.url,
            mediaType: file.type.startsWith('image/') ? 'image' : (file.type.includes('video') ? 'video' : 'document')
          });
        }
        nicePrompt.success("Upload Success", "Your media has been processed successfully.");
      }
    } catch (err) {
      console.error("Upload failed", err);
      nicePrompt.error("Upload Failed", "Please check your internet connection or try a different file.");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const generateCommerceTemplate = useCallback(() => {
    const commerceNodes = [
      // STEP 1: TRIGGER
      { id: 'node_start', type: 'custom', position: { x: 500, y: 0 }, data: { type: 'trigger', triggerType: 'order_created', label: 'Flow Start' } },

      // STEP 2: ORDER RECEIVED
      {
        id: 'node_received', type: 'custom', position: { x: 500, y: 250 }, data: {
          type: 'text',
          text: "🧾 *Order Received!*\n\nHi {{customer_name}},\nWe've received your order #{{order_id}} for ₹{{amount}}.\n\nPlease complete the payment to process your order."
        }
      },

      // STEP 3: PAYMENT NODE
      {
        id: 'node_payment', type: 'custom', position: { x: 500, y: 550 }, data: {
          type: 'payment',
          paymentType: 'link',
          bodyText: "💳 *Complete your Payment*",
          paymentLink: "{{checkout_url}}",
          footerText: "Safe & Secure Payment"
        }
      },

      // STEP 4: SUCCESS MESSAGE
      {
        id: 'node_success', type: 'custom', position: { x: 500, y: 850 }, data: {
          type: 'text',
          text: "✅ *Payment Received!*\n\nThank you for your payment. Your order is now being processed. We will notify you once it's shipped."
        }
      }
    ];

    const commerceEdges = [
      { id: 'e1', source: 'node_start', target: 'node_received', markerEnd: { type: 'arrowclosed' } },
      { id: 'e2', source: 'node_received', target: 'node_payment', markerEnd: { type: 'arrowclosed' } },
      { id: 'e3', source: 'node_payment', target: 'node_success', markerEnd: { type: 'arrowclosed' } }
    ];

    setNodes(commerceNodes);
    setEdges(commerceEdges);
    nicePrompt.success("Manual Payment Flow Applied", "A streamlined payment-focused order flow has been generated.");
  }, [setNodes, setEdges]);




  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `edge_${Date.now()}`,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#6b7280',
      },
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setIsRightPanelOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /**
   * 🔍 Real-time Keyword Collision Check for Selected Node
   */
  const checkConflicts = useCallback(async (keywordsToCheck) => {
    if (!keywordsToCheck || keywordsToCheck.length === 0) {
      setKeywordConflicts([]);
      return;
    }
    try {
      const res = await api.post('/flows/validate-keywords', {
        keywords: keywordsToCheck,
        excludeFlowId: flowId === 'new' || !flowId ? null : flowId
      });
      if (res.data.success) {
        setKeywordConflicts(res.data.conflicts || []);
      }
    } catch (err) {
      console.error("Collision check failed", err);
    }
  }, [flowId]);

  // Sync conflicts whenever keywords change in the active node
  useEffect(() => {
    if (!selectedNode) {
      setKeywordConflicts([]);
      return;
    }

    // Find keywords based on node type
    const node = nodes.find(n => n.id === selectedNode.id);
    if (!node) return;

    let keywordsToValidate = [];
    if (node.data?.type === 'trigger') {
      keywordsToValidate = node.data.keywords || [];
    } else if (node.data?.type === 'user_input') {
      keywordsToValidate = (node.data.keywordRoutes || [])
        .map(r => r.keyword)
        .filter(Boolean)
        .flatMap(k => k.split(",").map(s => s.trim()));
    }

    if (keywordsToValidate.length > 0) {
      const debounce = setTimeout(() => {
        checkConflicts(keywordsToValidate);
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setKeywordConflicts([]);
    }
  }, [selectedNode, nodes, checkConflicts]);

  const { project, getViewport } = useReactFlow();

  const addNode = (nodeType, position = null) => {
    // 🛡️ Calculate center of current view for better UX
    const { x, y, zoom } = getViewport();
    const center = project({
      x: (window.innerWidth / 2) - 160, // Center minus half node width
      y: (window.innerHeight / 2) - 100,
    });

    const newNode = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position: position || center,
      data: {
        type: nodeType,
        label: NODE_TYPES.find(n => n.type === nodeType)?.label,
        // Default data based on type
        ...(nodeType === 'trigger' && { triggerType: 'Message Received', keywords: [] }),
        ...(nodeType === 'text' && { text: '', buttons: [] }),
        ...(nodeType === 'template' && { templateName: '', templatePreview: null }),
        ...(nodeType === 'delay' && { delay: 5, delayUnit: 'minutes' }),
        ...(nodeType === 'condition' && { condition: '', options: ['Yes', 'No'] }),
        ...(nodeType === 'single_product' && { productTitle: '', price: '', currency: '₹', imageUrl: '', description: '' }),
        ...(nodeType === 'multi_product' && { products: [], currency: '₹' }),
        ...(nodeType === 'list' && { listTitle: '', options: [] }),
        ...(nodeType === 'action' && { action: '' }),
        ...(nodeType === 'user_input' && { variableName: 'user_reply', routingMode: 'free', keywordRoutes: [] }),
        ...(nodeType === 'whatsapp_flow' && { flowId: '', buttonText: 'Open Form', bodyText: 'Please fill out this form:', flowName: '' }),
        ...(nodeType === 'api' && { url: '', method: 'GET', headers: '', payload: '' }),
        ...(nodeType === 'tag' && { tagName: '', actionType: 'add' }),
      },
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
    setIsRightPanelOpen(true);
  };

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const duplicateNode = useCallback((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      const newNode = {
        ...node,
        id: `node_${Date.now()}`,
        selected: true,
        position: {
          x: node.position.x + 350,
          y: node.position.y + 100,
        },
      };

      // Deselect all others first to prevent simultaneous movement
      setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(newNode));

      // ✅ Auto-select the duplicate for a better UX
      setSelectedNode(newNode);
      setIsRightPanelOpen(true);
    }
  }, [nodes, setNodes]);

  const updateNode = useCallback((nodeId, updates) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [setNodes]);

  const addNextNode = useCallback((sourceNodeId) => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (sourceNode) {
      const newNodeId = `node_${Date.now()}`;
      const newNode = {
        id: newNodeId,
        type: 'custom',
        position: {
          x: sourceNode.position.x,
          y: sourceNode.position.y + 150,
        },
        data: {
          type: 'text',
          label: 'Text Message',
          text: '',
          buttons: [],
        },
      };

      const newEdge = {
        id: `edge_${Date.now()}`,
        source: sourceNodeId,
        target: newNodeId,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#6b7280',
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) => eds.concat(newEdge));
      setSelectedNode(newNode);
    }
  }, [nodes, setNodes, setEdges]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    // Auto-fit view after layout to show everything clearly
    setTimeout(() => {
      onPaneClick(); // Clear selection
    }, 100);
  }, [nodes, edges, setNodes, setEdges]);

  const saveFlow = async () => {
    try {
      // --- Pre-Save Validation Engine ---
      if (nodes.length > 1 && edges.length === 0) {
        alert("Validation Error: Please connect your flow steps before saving.");
        return;
      }

      for (const node of nodes) {
        const type = node.data?.type;
        if (type === 'text' && !node.data.text?.trim()) {
          nicePrompt.error("Missing Content", `Your message block (${node.id}) is empty. Please provide the message text before saving.`);
          return;
        }
        if (type === 'media' && !node.data.imageUrl) {
          nicePrompt.error("Media Required", `Your media block (${node.id}) needs a file or URL to be attached.`);
          return;
        }
        if (type === 'template' && !node.data.templateName) {
          nicePrompt.error("Select Template", `Please choose a template for the block (${node.id}) before continuing.`);
          return;
        }
      }
      // --- End Validation ---

      // Determine if this is an edit or create
      const isEdit = flowId && flowId !== 'new';

      // Get flow name from custom high-end prompt
      const flowName = await nicePrompt.ask(
        "Workflow Name",
        "Give your automation a recognizable name to keep things organized.",
        "e.g. Abandoned Cart Recovery",
        isEdit ? savedFlow?.name || "Updated Flow" : `Flow ${Date.now()}`
      );

      if (!flowName) return; // User cancelled

      // Clean node data by removing React functions and circular references
      const cleanNodes = nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          ...node.data,
          // Explicitly ensure critical fields are present
          type: node.data?.type,
          triggerType: node.data?.triggerType,
          keywords: node.data?.keywords || [],
          text: node.data?.text || node.data?.message,
          imageUrl: node.data?.imageUrl || node.data?.url,
          buttons: node.data?.buttons || [],
          options: node.data?.options || [],
          // Remove potential function references that break JSON.stringify
          onEdit: undefined,
          onDelete: undefined,
          onDuplicate: undefined
        }
      }));

      // Extract root-level metadata from nodes (e.g. trigger type)
      const triggerNode = nodes.find(n => n.data?.type === 'trigger');

      const flowData = {
        name: flowName,
        nodes: cleanNodes,
        connections: edges, // Convert edges to connections for backend compatibility
        triggerType: triggerNode?.data?.triggerType || "Message Received",
        cooldownHours: triggerNode?.data?.cooldownHours ? parseInt(triggerNode.data.cooldownHours, 10) : 0,
        status: savedFlow?.status || "paused"
      };

      console.log('Saving flow data:', {
        isEdit,
        flowId,
        flowName,
        nodeCount: cleanNodes.length,
        edgeCount: edges.length
      });

      let saveResponse;

      if (isEdit) {
        // ✅ EDIT: Update existing flow with PUT
        if (!flowId) {
          throw new Error("Flow ID is missing. Cannot update flow.");
        }
        console.log(`Updating flow: ${flowId} with name: ${flowName}`);
        saveResponse = await api.put(`/flows/${flowId}`, flowData);

        // Update local status with response
        if (saveResponse.data.success && saveResponse.data.flow) {
          setSavedFlow(saveResponse.data.flow);
          nicePrompt.success("Workflow Updated", `"${flowName}" has been saved successfully.`);

          // Optionally, we can stay on the page for edits
          // navigate(`/automation/flows/${flowId}`, { replace: true });
        }
      } else {
        // ✅ CREATE: New flow with POST
        console.log(`Creating new flow with name: ${flowName}`);
        saveResponse = await api.post("/flows", flowData);

        if (saveResponse.data.success && saveResponse.data.flow) {
          nicePrompt.success("Workflow Created", `"${flowName}" is ready to be activated.`);
          // Redirect to the EDIT page of the new flow so subsequent saves work as UPDATES
          const newFlowId = saveResponse.data.flow._id;
          navigate(`/automation/flows/${newFlowId}`, { replace: true });
          return;
        }
      }

      // If we are still here (for edits), just stay and update the local state if needed
      if (saveResponse.data?.flow) {
        setSavedFlow(saveResponse.data.flow);
      }
    } catch (err) {
      console.error("Save failed:", err);
      console.error("Error response:", err.response?.data);
      nicePrompt.error(
        "Save Failed",
        err.response?.data?.error || err.message || "An error occurred while saving your flow."
      );
    }
  };


  // Handle node actions
  const handleNodeAction = useCallback((action, nodeId, event) => {
    event.stopPropagation();

    switch (action) {
      case 'edit':
        setSelectedNode(nodes.find(n => n.id === nodeId));
        setIsRightPanelOpen(true);
        break;
      case 'duplicate':
        duplicateNode(nodeId);
        break;
      case 'delete':
        deleteNode(nodeId);
        break;
      case 'addNext':
        addNextNode(nodeId);
        break;
    }
  }, [nodes, duplicateNode, deleteNode, addNextNode, setSelectedNode]);

  const disconnectNode = useCallback((nodeId) => {
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    nicePrompt.success("Disconnected", "All connections for this step have been removed.");
  }, [setEdges]);

  // Derived state for the currently selected node to ensure real-time updates while typing
  const activeNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null;

  return (
    <div className="absolute inset-0 flex flex-col bg-[#F4F7FE] font-[Poppins]">
      {/* Top Header - Seamless integration with page background */}
      <div className="h-[80px] bg-transparent px-8 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/automation/flows')}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-white rounded-full transition-all border border-slate-200 shadow-sm"
          >
            <FiArrowLeft size={18} strokeWidth={2.5} />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-[18px] font-semibold text-slate-900 tracking-tight">
                {savedFlow?.name || (flowId && flowId !== 'new' ? 'Loading...' : 'New Flow')}
              </h1>
              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 tracking-widest leading-normal">
                {flowId && flowId !== 'new' ? 'EDIT' : 'CREATE'}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1 opacity-70">Flow Builder Canvas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedFlow && (
            <button
              onClick={async () => {
                const newStatus = savedFlow.status === 'active' ? 'paused' : 'active';
                try {
                  const res = await api.patch(`/flows/${flowId}/status`, { status: newStatus });
                  if (res.data.success) {
                    setSavedFlow({ ...savedFlow, status: newStatus });
                    if (newStatus === 'active') {
                      nicePrompt.success("Flow Activated", "Your automation is now live and waiting for triggers.");
                    } else {
                      nicePrompt.info("Flow Paused", "Automation suspended. Users will no longer trigger this flow.");
                    }
                  }
                } catch (err) {
                  nicePrompt.error("Status Update Failed", "Could not change flow status. Please try again.");
                }
              }}
              className={`px-5 h-10 text-[12px] font-bold rounded-[12px] border transition-all flex items-center gap-2 shadow-sm ${savedFlow.status === 'active'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                }`}
            >
              <div className={`w-2 h-2 rounded-full ${savedFlow.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {savedFlow.status === 'active' ? 'ACTIVE' : 'PAUSED'}
            </button>
          )}

          <button
            onClick={onLayout}
            className="px-5 h-10 text-[12px] font-semibold text-amber-600 bg-white hover:bg-amber-50 rounded-[12px] border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
          >
            <FiGrid size={15} strokeWidth={2.5} />
            Magic Align
          </button>
          <button
            onClick={saveFlow}
            className="px-6 h-10 bg-slate-900 text-white rounded-[12px] text-[12px] font-semibold hover:bg-black shadow-xl shadow-slate-200 transition-all flex items-center gap-2 active:scale-95 ml-2"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative p-4 pt-1 gap-6">

        {/* Left Panel - Content Block */}
        <div className="w-[340px] bg-white/90 backdrop-blur-xl border border-slate-200 flex flex-col z-20 overflow-hidden rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] animate-in slide-in-from-left duration-700">
          <div className="p-8 border-b border-slate-100/50 bg-transparent">
            <h3 className="text-[16px] font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
              Content Block
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-[0.1em] mt-1 opacity-60">Drag and drop to build</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3.5 scrollbar-hide">
            {NODE_TYPES.map((nodeType) => {
              const IconComponent = nodeType.icon;
              return (
                <button
                  key={nodeType.type}
                  onClick={() => addNode(nodeType.type)}
                  className="w-full h-[72px] text-left px-5 rounded-[24px] bg-white border border-slate-100 hover:border-blue-500/30 hover:bg-blue-50/20 transition-all flex items-center gap-4 group shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:shadow-2xl hover:shadow-blue-500/5 active:scale-[0.98]"
                >
                  <div className={`w-11 h-11 rounded-[16px] flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-sm
                    ${nodeType.color === 'emerald' ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500' : ''}
                    ${nodeType.color === 'blue' ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-600' : ''}
                    ${nodeType.color === 'indigo' ? 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-600' : ''}
                    ${nodeType.color === 'amber' ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-500' : ''}
                    ${nodeType.color === 'sky' ? 'bg-sky-50 text-sky-500 group-hover:bg-sky-500' : ''}
                    ${nodeType.color === 'slate' ? 'bg-slate-50 text-slate-500 group-hover:bg-slate-600' : ''}
                    ${nodeType.color === 'violet' ? 'bg-violet-50 text-violet-500 group-hover:bg-violet-600' : ''}
                    ${nodeType.color === 'rose' ? 'bg-rose-50 text-rose-500 group-hover:bg-rose-600' : ''}
                    group-hover:text-white`}>
                    <IconComponent size={20} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 text-[14px] tracking-tight group-hover:text-blue-600 transition-colors truncate">{nodeType.label}</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest opacity-60">Click to add</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-[inset_0_2px_12px_rgba(0,0,0,0.02)] animate-in fade-in duration-1000">
          <ReactFlow
            nodes={nodes.map(node => ({
              ...node,
              data: {
                ...node.data,
                onEdit: (e) => handleNodeAction('edit', node.id, e),
                onDuplicate: (e) => handleNodeAction('duplicate', node.id, e),
                onDelete: (e) => handleNodeAction('delete', node.id, e),
                onDisconnect: (e) => disconnectNode(node.id),
                onAddNext: (e) => handleNodeAction('addNext', node.id, e),
              }
            }))}
            edges={edges.map(edge => {
              const isSelectedNodeConnected = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
              const isActive = edge.selected || isSelectedNodeConnected;

              return {
                ...edge,
                type: 'default', // Smooth Bezier paths
                style: {
                  stroke: isActive ? '#3b82f6' : '#CBD5E1',
                  strokeWidth: isActive ? 2 : 2,
                  transition: 'all 0.3s ease',
                  opacity: isActive || !selectedNode ? 1 : 0.4,
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))' : 'none',
                },
                animated: false,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                  color: isActive ? '#3b82f6' : '#CBD5E1',
                },
              };
            })}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={reactFlowNodeTypes}
            fitView
            attributionPosition="bottom-left"
            connectionLineStyle={{
              stroke: '#3b82f6',
              strokeWidth: 2,
            }}
            defaultEdgeOptions={{
              type: 'default',
            }}
          >
            <Background variant="dots" color="#e2e8f0" gap={20} size={1} />
            <Controls className="!bg-white !border-slate-200 !shadow-2xl !rounded-2xl !p-1.5" />
            <MiniMap
              nodeColor={() => '#3b82f6'}
              style={{ borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white' }}
              maskColor="rgba(244, 247, 254, 0.6)"
              strokeColor="#3b82f6"
            />
          </ReactFlow>
        </div>

        {/* Right Panel Wrapper */}
        <div className="relative flex-shrink-0 h-full flex flex-col group">
          <style>
            {`
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #e2e8f0;
                border-radius: 10px;
                border: 2px solid transparent;
                background-clip: content-box;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #cbd5e1;
                border: 2px solid transparent;
                background-clip: content-box;
              }
            `}
          </style>

          {/* Toggle Button - Integrated "Pull Tab" design */}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`absolute top-[120px] left-0 -translate-x-[20px] w-[20px] h-20 bg-white border border-slate-200 border-r-0 rounded-l-[12px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:shadow-[-4px_0_20px_rgba(59,130,246,0.1)] shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-30 transition-all cursor-pointer group/tab`}
            title={isRightPanelOpen ? "Collapse Configuration" : "Expand Configuration"}
          >
            <div className={`transition-transform duration-500 ${isRightPanelOpen ? '' : 'rotate-180'}`}>
              <FiChevronRight size={16} strokeWidth={2.5} />
            </div>
          </button>

          <div
            className={`bg-white/90 backdrop-blur-xl border border-slate-200 flex flex-col z-20 overflow-hidden rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] transition-all duration-500 ease-in-out ${isRightPanelOpen ? 'w-[450px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
              }`}
          >
            <div className="min-w-[450px] flex flex-col h-full">
              <div className="p-8 border-b border-slate-100/50 bg-transparent flex-shrink-0">
                <h3 className="text-[16px] font-semibold text-slate-900 tracking-tight flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-500/10">
                    <FiSettings size={18} strokeWidth={1.5} />
                  </div>
                  Configuration
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-[0.1em] mt-1 opacity-60">Fine-tune your step</p>
              </div>

              <div className="flex-1 overflow-y-auto p-7 space-y-8 custom-scrollbar">
                {!activeNode ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6 px-10">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                      <FiSettings size={44} className="text-slate-200 animate-[spin_10s_linear_infinite]" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[15px] font-semibold text-slate-800 tracking-tight">Ready to Configure?</h4>
                      <p className="text-[12px] font-semibold text-slate-400 leading-relaxed uppercase tracking-wider">
                        Select a Content Block to start configuring your WhatsApp automation
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 pb-28">
                    <div className="bg-slate-50 rounded-[20px] p-5 border border-slate-100 shadow-sm">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">
                        Selected Element
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                          {React.createElement(NODE_TYPES.find(n => n.type === activeNode.data.type)?.icon || FiSettings, { size: 24, strokeWidth: 1.5 })}
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold text-slate-800 leading-tight">
                            {NODE_TYPES.find(n => n.type === activeNode.data.type)?.label}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Step ID: {activeNode.id.split('_').pop()}</div>
                        </div>
                      </div>
                    </div>

                    {savedFlow?.status === 'paused' && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-4 flex items-start gap-3 animate-pulse">
                        <FiAlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={16} />
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Flow is Paused</p>
                          <p className="text-[10px] text-amber-500 font-medium leading-tight">
                            This automation will not run until you click the <span className="font-bold">PAUSED</span> button in the header to activate it.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Text & Media Message Configuration */}
                    {(activeNode.data.type === 'text' || activeNode.data.type === 'media') && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Message Content</label>
                          <textarea
                            value={activeNode.data.text || ''}
                            onChange={(e) => updateNode(activeNode.id, { text: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all min-h-[140px] shadow-sm"
                            placeholder="Enter the message customers will receive..."
                          />
                        </div>

                        {activeNode.data.type === 'media' && (
                          <div className="space-y-4">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest pl-1">Media Assets</label>
                            <div className="flex flex-col gap-3">
                              <input
                                value={activeNode.data.imageUrl || ''}
                                onChange={(e) => updateNode(activeNode.id, { imageUrl: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                                placeholder="Media URL (Image/Video/PDF)..."
                              />
                              <label className={`w-full py-5 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group ${isUploadingMedia ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-blue-500 hover:bg-blue-50/50'}`}>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*,video/*,application/pdf"
                                  disabled={isUploadingMedia}
                                  onChange={(e) => handleMediaUpload(e.target.files[0])}
                                />
                                {isUploadingMedia ? (
                                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <FiPlus size={20} className="text-slate-400 group-hover:text-blue-600 transition-all" />
                                )}
                                <span className="text-[11px] font-semibold text-slate-400 group-hover:text-blue-600">
                                  {isUploadingMedia ? 'PROCESSING...' : 'UPLOAD MEDIA'}
                                </span>
                              </label>
                            </div>
                            {activeNode.data.imageUrl && (
                              <div className="rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 p-2">
                                {(activeNode.data.imageUrl.includes('.mp4') || activeNode.data.mediaType === 'video') ? (
                                  <video src={activeNode.data.imageUrl} className="w-full aspect-video object-cover rounded-lg" controls />
                                ) : (activeNode.data.imageUrl.includes('.pdf') || activeNode.data.mediaType === 'document') ? (
                                  <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-100">
                                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center font-semibold text-[10px]">PDF</div>
                                    <span className="text-xs font-semibold text-slate-600">Document Uploaded</span>
                                  </div>
                                ) : (
                                  <img src={activeNode.data.imageUrl} className="w-full aspect-video object-cover rounded-lg" alt="Preview" />
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Interactive Buttons (Max 3)</label>
                            {(!activeNode.data.buttons || activeNode.data.buttons.length < 3) && (
                              <button
                                onClick={() => {
                                  const buttons = [...(activeNode.data.buttons || []), { text: 'New Button', type: 'reply', value: '' }];
                                  updateNode(activeNode.id, { buttons });
                                }}
                                className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] flex items-center gap-1"
                              >
                                <FiPlus size={12} /> Add Button
                              </button>
                            )}
                          </div>
                          <div className="space-y-4">
                            {(activeNode.data.buttons || []).map((btn, i) => {
                              const btnObj = typeof btn === 'object' ? btn : { text: btn, type: 'reply' };
                              return (
                                <div key={i} className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4 relative group/card hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
                                  <button
                                    onClick={() => {
                                      const buttons = [...(activeNode.data.buttons || [])];
                                      buttons.splice(i, 1);
                                      updateNode(activeNode.id, { buttons });
                                    }}
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover/card:opacity-100 transition-all z-10 hover:bg-red-50"
                                  >
                                    <FiTrash2 size={13} />
                                  </button>

                                  <div className="grid grid-cols-1 gap-4">
                                    {/* Button Type Selector */}
                                    <div className="relative">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest absolute -top-1.5 left-3 bg-white px-1.5 z-10">Button Type</label>
                                      <select
                                        value={btnObj.type || 'reply'}
                                        onChange={(e) => {
                                          const buttons = [...(activeNode.data.buttons || [])];
                                          buttons[i] = { ...btnObj, type: e.target.value };
                                          updateNode(activeNode.id, { buttons });
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-600 outline-none focus:border-blue-500 shadow-sm appearance-none cursor-pointer"
                                      >
                                        <option value="reply">💬 Quick Reply</option>
                                        <option value="url">🔗 Visit Website</option>
                                      </select>
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                        <FiChevronRight size={14} className="rotate-90" />
                                      </div>
                                    </div>

                                    {/* Button Text Input */}
                                    <div className="relative">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest absolute -top-1.5 left-3 bg-white px-1.5 z-10">Button Text</label>
                                      <input
                                        value={btnObj.text || ''}
                                        onChange={(e) => {
                                          const buttons = [...(activeNode.data.buttons || [])];
                                          buttons[i] = { ...btnObj, text: e.target.value };
                                          updateNode(activeNode.id, { buttons });
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-all"
                                        placeholder="e.g. Learn More"
                                      />
                                    </div>

                                    {/* Terminal nodes (URL) don't have handles */}
                                    {/* const isTerminal = button.type === 'url' || button.type === 'website'; */}
                                    {btnObj.type === 'url' && (
                                      <div className="relative animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-bold text-blue-500 uppercase tracking-widest absolute -top-1.5 left-3 bg-white px-1.5 z-10">
                                          Target Link
                                        </label>
                                        <input
                                          value={btnObj.url || ''}
                                          onChange={(e) => {
                                            const buttons = [...(activeNode.data.buttons || [])];
                                            buttons[i] = { ...btnObj, url: e.target.value };
                                            updateNode(activeNode.id, { buttons });
                                          }}
                                          className="w-full bg-blue-50/30 border border-blue-100 rounded-2xl px-4 py-3 text-[12px] font-medium text-blue-700 outline-none focus:border-blue-400 shadow-sm transition-all"
                                          placeholder="https://..."
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Single Product Configuration */}
                    {activeNode.data.type === 'single_product' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Product Image URL</label>
                          <div className="relative group">
                            <input
                              value={activeNode.data.imageUrl || ''}
                              onChange={(e) => updateNode(activeNode.id, { imageUrl: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 transition-all shadow-sm"
                              placeholder="https://example.com/image.jpg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                              <FiImage size={16} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Price</label>
                            <input
                              value={activeNode.data.price || ''}
                              onChange={(e) => updateNode(activeNode.id, { price: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500 shadow-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Currency</label>
                            <input
                              value={activeNode.data.currency || '₹'}
                              onChange={(e) => updateNode(activeNode.id, { currency: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500 shadow-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Product Title</label>
                          <input
                            value={activeNode.data.productTitle || ''}
                            onChange={(e) => updateNode(activeNode.id, { productTitle: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500 shadow-sm"
                            placeholder="Premium Cotton Shirt"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Description</label>
                          <textarea
                            value={activeNode.data.description || ''}
                            onChange={(e) => updateNode(activeNode.id, { description: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 transition-all min-h-[100px] shadow-sm"
                            placeholder="Describe your product highlight..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Multi Product Configuration */}
                    {activeNode.data.type === 'multi_product' && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-4 px-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Catalog Products</label>
                            <button
                              onClick={() => {
                                const products = [...(activeNode.data.products || []), { title: '', price: '', image: '' }];
                                updateNode(activeNode.id, { products });
                              }}
                              className="px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-[10px] font-semibold hover:bg-cyan-600 hover:text-white transition-all flex items-center gap-2"
                            >
                              <FiPlus size={12} /> Add Item
                            </button>
                          </div>

                          <div className="space-y-4">
                            {(activeNode.data.products || []).map((prod, i) => (
                              <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative group/prod">
                                <button
                                  onClick={() => {
                                    const products = [...(activeNode.data.products || [])];
                                    products.splice(i, 1);
                                    updateNode(activeNode.id, { products });
                                  }}
                                  className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-red-100 text-red-500 flex items-center justify-center rounded-full shadow-sm hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover/prod:opacity-100 scale-75 group-hover/prod:scale-100"
                                >
                                  <FiTrash2 size={12} />
                                </button>
                                <div className="space-y-3">
                                  <input
                                    value={prod.title || ''}
                                    onChange={(e) => {
                                      const products = [...(activeNode.data.products || [])];
                                      products[i] = { ...prod, title: e.target.value };
                                      updateNode(activeNode.id, { products });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-cyan-500 shadow-sm"
                                    placeholder="Product Title"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      value={prod.price || ''}
                                      onChange={(e) => {
                                        const products = [...(activeNode.data.products || [])];
                                        products[i] = { ...prod, price: e.target.value };
                                        updateNode(activeNode.id, { products });
                                      }}
                                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-cyan-500 shadow-sm"
                                      placeholder="Price"
                                    />
                                    <input
                                      value={prod.image || ''}
                                      onChange={(e) => {
                                        const products = [...(activeNode.data.products || [])];
                                        products[i] = { ...prod, image: e.target.value };
                                        updateNode(activeNode.id, { products });
                                      }}
                                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-medium text-slate-500 outline-none focus:border-cyan-500 shadow-sm"
                                      placeholder="Image URL"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Configuration */}
                    {activeNode.data.type === 'template' && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">WhatsApp Template</label>
                            <button
                              onClick={async () => {
                                const res = await api.get('/templates/sync/meta');
                                if (res.data.success) {
                                  setTemplates(res.data.templates || []);
                                  alert(`Synced ${res.data.templates?.length || 0} templates from Meta`);
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-700 font-semibold text-[10px] flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                            >
                              <FiPlay size={10} className="rotate-90" /> Sync Meta
                            </button>
                          </div>
                          <div className="relative">
                            <select
                              value={activeNode.data.templateId || ''}
                              onChange={(e) => {
                                const template = templates.find(t => t._id === e.target.value);
                                updateNode(activeNode.id, {
                                  templateId: e.target.value,
                                  templateName: template?.name || template?.metaTemplateName,
                                  languageCode: template?.language || "en_US",
                                  templatePreview: template ? {
                                    header: template.header,
                                    body: template.body,
                                    buttons: template.buttons ? template.buttons.map(btn => btn.text || btn.type || 'Button') : [],
                                    footer: template.footer,
                                    variables: {} // Reset variables on change
                                  } : null,
                                  variables: {} // Reset variables on change
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer shadow-sm"
                            >
                              <option value="">Choose a template...</option>
                              {templates.map((template) => {
                                const langLabel = template.language === "en_US" ? "English" :
                                  template.language === "hi" || template.language === "hi_IN" ? "Hindi" :
                                    template.language === "gu" || template.language === "gu_IN" ? "Gujarati" : template.language;
                                return (
                                  <option key={template._id} value={template._id}>
                                    {template.name || template.metaTemplateName} ({langLabel})
                                  </option>
                                );
                              })}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <FiChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                        </div>

                        {/* Header Media Override */}
                        {(activeNode.data.templatePreview?.header?.format?.toUpperCase() === 'IMAGE' || activeNode.data.templatePreview?.header?.type?.toUpperCase() === 'IMAGE') && (
                          <div className="space-y-4 animate-in slide-in-from-top-4 p-4 bg-white border border-slate-100 rounded-3xl mt-4">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Header Image Override</label>
                              {activeNode.data.headerImageUrl && (
                                <button
                                  onClick={() => updateNode(activeNode.id, { headerImageUrl: '' })}
                                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </div>

                            <div className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-4 space-y-4">
                              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200/50">
                                <button
                                  type="button"
                                  onClick={() => setHeaderOverrideTab('url')}
                                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${headerOverrideTab === 'url' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  Image URL
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHeaderOverrideTab('upload')}
                                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${headerOverrideTab === 'upload' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  Upload
                                </button>
                              </div>

                              {headerOverrideTab === 'url' ? (
                                <div className="relative group">
                                  <input
                                    value={activeNode.data.headerImageUrl || ''}
                                    onChange={(e) => updateNode(activeNode.id, { headerImageUrl: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-[13px] font-medium text-slate-700 outline-none focus:border-indigo-500 shadow-sm transition-all"
                                    placeholder="https://example.com/image.jpg"
                                  />
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                    <FiImage size={16} />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => !isUploadingMedia && fileInputRef.current?.click()}
                                  className={`h-[100px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${activeNode.data.headerImageUrl ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'}`}
                                >
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) handleMediaUpload(file);
                                    }}
                                    className="hidden"
                                    accept="image/*"
                                  />
                                  {isUploadingMedia ? (
                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                  ) : activeNode.data.headerImageUrl ? (
                                    <div className="flex flex-col items-center gap-1 text-emerald-600">
                                      <FiCheck size={20} />
                                      <span className="text-[10px] font-bold uppercase">Uploaded</span>
                                    </div>
                                  ) : (
                                    <>
                                      <FiPlus size={20} className="text-slate-400" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Click to upload</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bulk Paste Button */}
                        {activeNode.data.templatePreview?.body?.match(/\{\{(\d+)\}\}/) && (
                          <button
                            onClick={() => setShowPasteModal(true)}
                            className="w-full py-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl text-[12px] font-bold hover:bg-blue-100 transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            <FiEdit size={14} /> Bulk Paste Body Variables
                          </button>
                        )}

                        {/* Dynamic Variable Mapping */}
                        {((activeNode.data.templatePreview?.body || '').match(/\{\{(\d+)\}\}/) || (activeNode.data.templatePreview?.header?.text || '').match(/\{\{(\d+)\}\}/)) && (
                          <div className="space-y-4 animate-in fade-in duration-500 p-4 bg-white border border-slate-100 rounded-3xl mt-4">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Manual Variable Mapping</label>
                              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase">Input Fields</span>
                            </div>

                            {(() => {
                              const headerText = activeNode.data.templatePreview.header?.text || '';
                              const bodyText = activeNode.data.templatePreview.body || '';
                              const allMatches = [
                                ...Array.from(headerText.matchAll(/\{\{(\d+)\}\}/g)),
                                ...Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g))
                              ];
                              const uniqueVars = [...new Set(allMatches.map(m => m[1]))].sort((a, b) => parseInt(a) - parseInt(b));

                              return uniqueVars.map((varNum) => (
                                <div key={varNum} className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="w-10 h-6 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-[11px] font-black border border-indigo-100">
                                      {"{{"}{varNum}{"}}"}
                                    </div>
                                    <select
                                      value={activeNode.data.variables?.[varNum]?.startsWith('{{') ? activeNode.data.variables[varNum] : 'static'}
                                      onChange={(e) => {
                                        const variables = { ...(activeNode.data.variables || {}) };
                                        variables[varNum] = e.target.value === 'static' ? '' : e.target.value;
                                        updateNode(activeNode.id, { variables });
                                      }}
                                      className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none"
                                    >
                                      <option value="static">Manual Input</option>
                                      {SYSTEM_VARIABLES.map(sv => (
                                        <option key={sv.value} value={sv.value}>{sv.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {!activeNode.data.variables?.[varNum]?.startsWith('{{') && (
                                    <input
                                      value={activeNode.data.variables?.[varNum] || ''}
                                      onChange={(e) => {
                                        const variables = { ...(activeNode.data.variables || {}) };
                                        variables[varNum] = e.target.value;
                                        updateNode(activeNode.id, { variables });
                                      }}
                                      className="w-full h-10 px-4 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:border-indigo-400 shadow-sm"
                                      placeholder={`Enter value...`}
                                    />
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* System Template Configuration */}
                    {activeNode.data.type === 'system_template' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">System Template</label>
                          <div className="relative">
                            <select
                              value={activeNode.data.templateId || ''}
                              onChange={(e) => {
                                const template = systemTemplates.find(t => t._id === e.target.value);
                                updateNode(activeNode.id, {
                                  templateId: e.target.value,
                                  templateName: template?.name,
                                  text: template?.message,
                                  message: template?.message, // Sync both for engine/UI
                                  imageUrl: template?.imageUrl,
                                  buttons: template?.buttons || [],
                                  template: template // Keep full object
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500 shadow-sm appearance-none cursor-pointer"
                            >
                              <option value="">Choose a system template...</option>
                              {systemTemplates.map((t) => (
                                <option key={t._id} value={t._id}>{t.name}</option>
                              ))}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <FiChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                        </div>

                        {(activeNode.data.text || activeNode.data.imageUrl) && (
                          <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-100/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-widest block">Content Preview</span>
                              <div className="w-2 h-2 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                            </div>

                            {activeNode.data.imageUrl && (
                              <div className="aspect-video rounded-xl overflow-hidden border border-sky-100 bg-white">
                                <img src={activeNode.data.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                              </div>
                            )}

                            {activeNode.data.text && (
                              <p className="text-xs text-slate-600 line-clamp-3 italic leading-relaxed">"{activeNode.data.text}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Node Configuration */}
                    {activeNode.data.type === 'action' && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-rose-50/50 border border-rose-100 rounded-[24px] flex items-start gap-4">
                          <div className="w-12 h-12 bg-rose-500 text-white rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-200">
                            <FiZap size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-semibold text-rose-900 tracking-tight">System Action</h4>
                            <p className="text-[11px] font-semibold text-rose-600/70 leading-relaxed uppercase tracking-widest">Database / Process Update</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Select Action</label>
                          <div className="relative group">
                            <select
                              value={activeNode.data.actionType || activeNode.data.action || ''}
                              onChange={(e) => updateNode(activeNode.id, { actionType: e.target.value, action: e.target.value })}
                              className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-rose-500 shadow-sm appearance-none transition-all cursor-pointer"
                            >
                              <option value="">Choose an Action...</option>
                              <option value="confirm_order">Confirm Order (Mark as Confirmed)</option>
                              <option value="cancel_order">Cancel Order (Mark as Cancelled)</option>
                              <option value="book_appointment">Book Appointment (Create Entry)</option>
                              <option value="cancel_appointment">Cancel Appointment (Mark as Cancelled)</option>
                              <option value="mark_paid">Mark as Paid</option>
                              <option value="send_invoice">Send Invoice (Text Summary)</option>
                              <option value="track_order">Send Tracking Update</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-rose-500 transition-colors">
                              <FiChevronRight size={18} className="rotate-90" />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 px-1 italic font-medium">Note: These actions directly update the order record in your store database.</p>
                        </div>
                      </div>
                    )}

                    {/* Payment Node Configuration */}
                    {activeNode.data.type === 'payment' && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-[24px] flex items-start gap-4">
                          <div className="w-12 h-12 bg-indigo-600 text-white rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
                            <FiCreditCard size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-semibold text-indigo-900 tracking-tight">Payment Setup</h4>
                            <p className="text-[11px] font-semibold text-indigo-600/70 leading-relaxed uppercase tracking-widest">QR Code or Payment Link</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Payment Type</label>
                          <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-[20px] border border-slate-200/50">
                            <button
                              className={`flex items-center justify-center gap-2 py-3 text-[12px] font-semibold rounded-[14px] transition-all ${activeNode.data.paymentType !== 'qr' ? 'bg-white shadow-md text-indigo-600 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { paymentType: 'link' })}
                            >
                              <FiLink size={14} />
                              Payment Link
                            </button>
                            <button
                              className={`flex items-center justify-center gap-2 py-3 text-[12px] font-semibold rounded-[14px] transition-all ${activeNode.data.paymentType === 'qr' ? 'bg-white shadow-md text-indigo-600 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { paymentType: 'qr' })}
                            >
                              <FiMaximize size={14} />
                              QR Code
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Display Message</label>
                          <input
                            value={activeNode.data.bodyText || ''}
                            onChange={(e) => updateNode(activeNode.id, { bodyText: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 shadow-sm transition-all"
                            placeholder="e.g. Click to pay for your order"
                          />
                        </div>

                        {activeNode.data.paymentType === 'qr' ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">QR Code Image</label>
                              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/50">
                                <button
                                  type="button"
                                  onClick={() => setHeaderOverrideTab('url')}
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${headerOverrideTab === 'url' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  URL
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHeaderOverrideTab('upload')}
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${headerOverrideTab === 'upload' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  Upload
                                </button>
                              </div>
                            </div>

                            {headerOverrideTab === 'url' ? (
                              <input
                                value={activeNode.data.qrCodeUrl || ''}
                                onChange={(e) => updateNode(activeNode.id, { qrCodeUrl: e.target.value })}
                                className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 shadow-sm transition-all"
                                placeholder="https://example.com/qr-code.png"
                              />
                            ) : (
                              <div
                                onClick={() => !isUploadingMedia && fileInputRef.current?.click()}
                                className={`h-[120px] border-2 border-dashed rounded-[24px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${activeNode.data.qrCodeUrl ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'}`}
                              >
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) handleMediaUpload(file);
                                  }}
                                  className="hidden"
                                  accept="image/*"
                                />
                                {isUploadingMedia ? (
                                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                ) : activeNode.data.qrCodeUrl ? (
                                  <div className="flex flex-col items-center gap-1 text-emerald-600">
                                    <FiCheck size={24} />
                                    <span className="text-[11px] font-bold uppercase">QR Code Uploaded</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                                      <FiPlus size={20} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Click to upload QR</span>
                                  </>
                                )}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-2 px-1 italic">Pro Tip: Use a static UPI QR code or a dynamic payment gateway QR.</p>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Payment Link</label>
                            <input
                              value={activeNode.data.paymentLink || ''}
                              onChange={(e) => updateNode(activeNode.id, { paymentLink: e.target.value })}
                              className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 shadow-sm transition-all"
                              placeholder="{{checkout_url}}"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 px-1 italic">Use {"{{checkout_url}}"} to dynamically pull from your store integration.</p>
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Footer Message</label>
                          <input
                            value={activeNode.data.footerText || ''}
                            onChange={(e) => updateNode(activeNode.id, { footerText: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 shadow-sm transition-all"
                            placeholder="Safe & Secure Transaction"
                          />
                        </div>
                      </div>
                    )}

                    {/* WhatsApp Flow Configuration */}
                    {activeNode.data.type === 'whatsapp_flow' && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-[24px] flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-600 text-white rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-200">
                            <FiLayers size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-semibold text-blue-900 tracking-tight">WhatsApp Flow</h4>
                            <p className="text-[11px] font-semibold text-blue-600/70 leading-relaxed uppercase tracking-widest">Send Meta Native Form</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Select Flow</label>
                          <div className="relative group">
                            <select
                              value={activeNode.data.flowId || ''}
                              onChange={(e) => {
                                const selectedFlow = whatsappFlows.find(f => f._id === e.target.value);
                                updateNode(activeNode.id, { 
                                  flowId: e.target.value, 
                                  flowName: selectedFlow ? selectedFlow.name : '' 
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-sm appearance-none cursor-pointer"
                            >
                              <option value="">Choose a WhatsApp Flow...</option>
                              {whatsappFlows.map((f) => (
                                <option key={f._id} value={f._id}>{f.name}</option>
                              ))}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                              <FiChevronRight size={18} className="rotate-90" />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 px-1 mt-2 italic font-medium">Only published flows are available here. Flow data will automatically be captured.</p>
                          
                          {/* Flow UI Preview */}
                          {activeNode.data.flowId && whatsappFlows.find(f => f._id === activeNode.data.flowId) && (
                            <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden relative group/preview">
                              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                  <FiLayers className="text-blue-500 w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                  <h5 className="text-[13px] font-bold text-slate-800 leading-tight">
                                    {whatsappFlows.find(f => f._id === activeNode.data.flowId).name}
                                  </h5>
                                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                    Status: {whatsappFlows.find(f => f._id === activeNode.data.flowId).status}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Message Body</label>
                          <textarea
                            value={activeNode.data.bodyText || ''}
                            onChange={(e) => updateNode(activeNode.id, { bodyText: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-all min-h-[80px]"
                            placeholder="e.g. Please fill out this form to continue"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Button Text</label>
                          <input
                            value={activeNode.data.buttonText || ''}
                            onChange={(e) => updateNode(activeNode.id, { buttonText: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-all"
                            placeholder="e.g. Open Form"
                            maxLength={20}
                          />
                          <p className="text-[10px] text-slate-400 px-1 mt-2 italic">Max 20 characters.</p>
                        </div>
                      </div>
                    )}

                    {/* Condition Configuration */}
                    {activeNode.data.type === 'condition' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">If User Response...</label>
                          <textarea
                            value={activeNode.data.condition || ''}
                            onChange={(e) => updateNode(activeNode.id, { condition: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-purple-500 transition-all min-h-[80px] shadow-sm"
                            placeholder="e.g. Is 'Yes' or contains 'Pricing'..."
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Paths (Options)</label>
                            <button
                              onClick={() => {
                                const options = [...(activeNode.data.options || []), ''];
                                updateNode(activeNode.id, { options });
                              }}
                              className="text-purple-600 hover:text-purple-700 font-semibold text-[10px] flex items-center gap-1"
                            >
                              <FiPlus size={12} /> Add Path
                            </button>
                          </div>
                          <div className="space-y-3">
                            {(activeNode.data.options || []).map((opt, i) => (
                              <div key={i} className="flex gap-2">
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const options = [...(activeNode.data.options || [])];
                                    options[i] = e.target.value;
                                    updateNode(activeNode.id, { options });
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-purple-500 shadow-sm"
                                  placeholder={`Path ${i + 1}`}
                                />
                                <button
                                  onClick={() => {
                                    const options = [...(activeNode.data.options || [])];
                                    options.splice(i, 1);
                                    updateNode(activeNode.id, { options });
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delay Configuration */}
                    {activeNode.data.type === 'delay' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Wait Amount</label>
                          <input
                            type="number"
                            min="1"
                            value={activeNode.data.delay || ''}
                            onChange={(e) => updateNode(activeNode.id, { delay: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 shadow-sm"
                            placeholder="5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Wait Unit</label>
                          <select
                            value={activeNode.data.delayUnit || 'minutes'}
                            onChange={(e) => updateNode(activeNode.id, { delayUnit: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 shadow-sm"
                          >
                            <option value="seconds">Seconds</option>
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* User Input Configuration */}
                    {activeNode.data.type === 'user_input' && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-violet-50/50 border border-violet-100 rounded-[24px] flex items-start gap-4">
                          <div className="w-12 h-12 bg-violet-500 text-white rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-200">
                            <FiMessageSquare size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-semibold text-violet-900 tracking-tight">Capture User Response</h4>
                            <p className="text-[11px] font-semibold text-violet-600/70 leading-relaxed uppercase tracking-widest">Variable Capture & Routing</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Store Input As</label>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500 font-semibold text-sm group-focus-within:scale-110 transition-transform">{"{{"}</div>
                            <input
                              value={activeNode.data.variableName || 'user_reply'}
                              onChange={(e) => updateNode(activeNode.id, { variableName: e.target.value })}
                              className="w-full bg-white border-2 border-slate-100 rounded-[20px] pl-10 pr-10 py-4 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500 focus:ring-8 focus:ring-violet-500/5 transition-all shadow-sm"
                              placeholder="variable_name"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 font-semibold text-sm group-focus-within:scale-110 transition-transform">{"}}"}</div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Input Validation</label>
                          <select
                            value={activeNode.data.validation || ''}
                            onChange={(e) => updateNode(activeNode.id, { validation: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[20px] px-5 py-4 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500 shadow-sm appearance-none cursor-pointer"
                          >
                            <option value="">No Validation</option>
                            <option value="address">📍 Address (Min 10, Numbers + Text)</option>
                            <option value="pincode">🔢 Pincode (6 Digits)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Routing Mode</label>
                          <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-[20px] border border-slate-200/50">
                            <button
                              className={`flex items-center justify-center gap-2 py-3 text-[12px] font-semibold rounded-[14px] transition-all ${activeNode.data.routingMode !== 'keyword' ? 'bg-white shadow-md text-violet-600 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { routingMode: 'free' })}
                            >
                              <FiMessageSquare size={14} />
                              Free Text
                            </button>
                            <button
                              className={`flex items-center justify-center gap-2 py-3 text-[12px] font-semibold rounded-[14px] transition-all ${activeNode.data.routingMode === 'keyword' ? 'bg-white shadow-md text-violet-600 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { routingMode: 'keyword' })}
                            >
                              <FiTarget size={14} />
                              Keywords
                            </button>
                          </div>
                        </div>

                        {activeNode.data.routingMode === 'keyword' && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-400">
                            <div className="flex items-center justify-between px-1">
                              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Keywords & Branching</label>
                            </div>
                            <div className="space-y-3">
                              {/* Branch Collision Notice */}
                              {keywordConflicts.some(cf =>
                                activeNode.data.keywordRoutes?.some(r => r.keyword?.toLowerCase().trim() === cf.matchedKeywords[0])
                              ) && (
                                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in shake duration-500">
                                    <FiAlertTriangle className="text-red-500 mt-0.5 shrink-0" size={16} />
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Collision Alert</p>
                                      <p className="text-[10px] text-red-500 font-medium leading-tight">
                                        One of these keywords is already active in flow: <span className="font-bold underline">"{keywordConflicts.find(cf => activeNode.data.keywordRoutes?.some(r => r.keyword?.toLowerCase().trim() === cf.matchedKeywords[0]))?.flowName}"</span>. Pause it first.
                                      </p>
                                    </div>
                                  </div>
                                )}

                              {(activeNode.data.keywordRoutes || []).map((route, i) => (
                                <div key={i} className="flex gap-2 group animate-in zoom-in-95 duration-200">
                                  <input
                                    value={route.keyword}
                                    onChange={(e) => {
                                      const newRoutes = [...activeNode.data.keywordRoutes];
                                      newRoutes[i].keyword = e.target.value;
                                      updateNode(activeNode.id, { keywordRoutes: newRoutes });
                                    }}
                                    className="flex-1 bg-white border-2 border-slate-100 rounded-[16px] px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500 transition-all shadow-sm"
                                    placeholder="Keyword..."
                                  />
                                  <button
                                    onClick={() => {
                                      const newRoutes = activeNode.data.keywordRoutes.filter((_, idx) => idx !== i);
                                      updateNode(activeNode.id, { keywordRoutes: newRoutes });
                                    }}
                                    className="w-11 h-11 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-500 rounded-[14px] transition-all"
                                  >
                                    <FiTrash2 size={18} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const newRoutes = [...(activeNode.data.keywordRoutes || []), { keyword: '', target: '' }];
                                  updateNode(activeNode.id, { keywordRoutes: newRoutes });
                                }}
                                className="w-full py-4 border-2 border-dashed border-violet-200 rounded-[20px] text-violet-500 text-xs font-semibold uppercase tracking-widest hover:bg-violet-50 hover:border-violet-300 transition-all active:scale-95 group"
                              >
                                <span className="flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                                  <FiPlus size={16} /> Add Condition
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive List Configuration */}
                    {activeNode.data.type === 'interactive_list' && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-[24px] flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-500 text-white rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-200">
                            <FiGrid size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-semibold text-purple-900 tracking-tight">Interactive Menu</h4>
                            <p className="text-[11px] font-semibold text-purple-600/70 leading-relaxed uppercase tracking-widest">WhatsApp List Message</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Body Text</label>
                          <textarea
                            value={activeNode.data.bodyText || activeNode.data.text || ''}
                            onChange={(e) => updateNode(activeNode.id, { bodyText: e.target.value, text: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[20px] px-5 py-4 text-sm font-medium text-slate-800 outline-none focus:border-purple-500 focus:ring-8 focus:ring-purple-500/5 transition-all min-h-[120px] shadow-sm"
                            placeholder="Please select an option from the list below..."
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Menu Button Label</label>
                          <input
                            value={activeNode.data.buttonText || ''}
                            onChange={(e) => updateNode(activeNode.id, { buttonText: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-purple-500 shadow-sm"
                            placeholder="View Options"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-4 px-1">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Menu Sections</label>
                            <button
                              onClick={() => {
                                const sections = [...(activeNode.data.sections || []), { title: 'Menu', rows: [{ id: `opt-${Date.now()}`, title: 'Option', description: '' }] }];
                                updateNode(activeNode.id, { sections });
                              }}
                              className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-bold hover:bg-purple-600 hover:text-white transition-all flex items-center gap-2 border border-purple-100"
                            >
                              <FiPlus size={14} /> Add Section
                            </button>
                          </div>

                          <div className="space-y-6">
                            {(activeNode.data.sections || []).map((section, sIdx) => (
                              <div key={sIdx} className="bg-slate-50/50 rounded-[24px] p-6 border border-slate-100 relative group/sec animate-in zoom-in-95 duration-200">
                                <button
                                  onClick={() => {
                                    const sections = [...(activeNode.data.sections || [])];
                                    sections.splice(sIdx, 1);
                                    updateNode(activeNode.id, { sections });
                                  }}
                                  className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-red-100 text-red-500 flex items-center justify-center rounded-full shadow-md hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover/sec:opacity-100"
                                >
                                  <FiTrash2 size={14} />
                                </button>

                                <div className="space-y-5">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em]">Section Title</span>
                                    <input
                                      value={section.title || ''}
                                      onChange={(e) => {
                                        const sections = [...(activeNode.data.sections || [])];
                                        sections[sIdx] = { ...section, title: e.target.value };
                                        updateNode(activeNode.id, { sections });
                                      }}
                                      className="w-full bg-transparent border-b-2 border-slate-200/50 py-1 text-[15px] font-bold text-slate-900 outline-none focus:border-purple-400 placeholder:text-slate-300 transition-all"
                                      placeholder="Main Options"
                                    />
                                  </div>

                                  <div className="space-y-3.5">
                                    {(section.rows || []).map((row, rIdx) => (
                                      <div key={rIdx} className="bg-white rounded-2xl p-4 border border-slate-200 relative group/row shadow-sm hover:shadow-md transition-all">
                                        <button
                                          onClick={() => {
                                            const sections = [...(activeNode.data.sections || [])];
                                            sections[sIdx].rows.splice(rIdx, 1);
                                            updateNode(activeNode.id, { sections });
                                          }}
                                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-red-50 text-red-400 flex items-center justify-center rounded-full shadow-sm hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover/row:opacity-100"
                                        >
                                          <FiX size={12} />
                                        </button>
                                        <div className="space-y-3">
                                          <div className="space-y-1">
                                            <input
                                              value={row.title || ''}
                                              onChange={(e) => {
                                                const sections = [...(activeNode.data.sections || [])];
                                                sections[sIdx].rows[rIdx] = { ...row, title: e.target.value };
                                                updateNode(activeNode.id, { sections });
                                              }}
                                              className="w-full text-[13px] font-bold text-slate-800 outline-none placeholder:text-slate-300"
                                              placeholder="Row Title (required)"
                                            />
                                            <input
                                              value={row.description || ''}
                                              onChange={(e) => {
                                                const sections = [...(activeNode.data.sections || [])];
                                                sections[sIdx].rows[rIdx] = { ...row, description: e.target.value };
                                                updateNode(activeNode.id, { sections });
                                              }}
                                              className="w-full text-[11px] text-slate-500 font-medium outline-none placeholder:text-slate-300"
                                              placeholder="Description (optional)"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2 pt-2 border-t border-slate-50 mt-1">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Handle ID:</span>
                                            <input
                                              value={row.id || ''}
                                              onChange={(e) => {
                                                const sections = [...(activeNode.data.sections || [])];
                                                const sanitizedId = e.target.value.toLowerCase().trim().replace(/\s+/g, '_');
                                                sections[sIdx].rows[rIdx] = { ...row, id: sanitizedId };
                                                updateNode(activeNode.id, { sections });
                                              }}
                                              className="bg-purple-50 px-2 py-0.5 rounded text-[10px] font-bold text-purple-500 outline-none w-full"
                                              placeholder="unique_row_id"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        const sections = [...(activeNode.data.sections || [])];
                                        sections[sIdx].rows = [...(sections[sIdx].rows || []), { id: `opt-${Date.now()}`, title: '', description: '' }];
                                        updateNode(activeNode.id, { sections });
                                      }}
                                      className="w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[11px] font-bold text-slate-400 hover:text-purple-600 hover:border-purple-200 transition-all group/addrow"
                                    >
                                      <span className="flex items-center justify-center gap-2 group-hover/addrow:scale-105 transition-transform">
                                        <FiPlus size={14} /> Add Row Item
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3 pl-1">Footer Text (Optional)</label>
                          <input
                            value={activeNode.data.footerText || ''}
                            onChange={(e) => updateNode(activeNode.id, { footerText: e.target.value })}
                            className="w-full bg-white border-2 border-slate-100 rounded-[16px] px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-purple-500 shadow-sm transition-all"
                            placeholder="Zepofy Commerce Engine"
                          />
                        </div>
                      </div>
                    )}

                    {/* API Request Configuration */}
                    {activeNode.data.type === 'api' && (
                      <div className="space-y-6">
                        <div className="flex gap-2">
                          <div className="w-1/3">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Method</label>
                            <select
                              value={activeNode.data.method || 'GET'}
                              onChange={(e) => updateNode(activeNode.id, { method: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 shadow-sm"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Endpoint URL</label>
                            <input
                              value={activeNode.data.url || ''}
                              onChange={(e) => updateNode(activeNode.id, { url: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500 shadow-sm"
                              placeholder="https://api.example.com/data"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Payload (JSON)</label>
                          <textarea
                            value={activeNode.data.payload || ''}
                            onChange={(e) => updateNode(activeNode.id, { payload: e.target.value })}
                            className="w-full bg-slate-900 border-none rounded-2xl px-5 py-4 text-xs font-mono text-cyan-400 outline-none min-h-[100px] shadow-inner"
                            placeholder="{&#10;  &#34;order_id&#34;: &#34;{{user.order}}&#34;&#10;}"
                          />
                        </div>
                      </div>
                    )}

                    {/* Tag Configuration */}
                    {activeNode.data.type === 'tag' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Action</label>
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeNode.data.actionType !== 'remove' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { actionType: 'add' })}
                            >
                              Add Tag
                            </button>
                            <button
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeNode.data.actionType === 'remove' ? 'bg-white shadow-sm text-red-500' : 'text-slate-500 hover:bg-slate-200'}`}
                              onClick={() => updateNode(activeNode.id, { actionType: 'remove' })}
                            >
                              Remove Tag
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 pl-1">Tag Name</label>
                          <input
                            value={activeNode.data.tagName || ''}
                            onChange={(e) => updateNode(activeNode.id, { tagName: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 shadow-sm"
                            placeholder="e.g. VIP Customer, Interested"
                          />
                        </div>
                      </div>
                    )}

                    {/* Human Agent Configuration */}
                    {activeNode.data.type === 'intervention' && (
                      <div className="space-y-6">
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-4">
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FiSettings size={20} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[13px] font-semibold text-orange-800 tracking-tight">Human Intervention</h4>
                            <p className="text-[11px] font-medium text-orange-600 leading-relaxed opacity-80">
                              When this node is reached, the automated flow will pause and notify a live agent to take over the conversation.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Handover Message</label>
                          <textarea
                            value={activeNode.data.handoverMessage || ''}
                            onChange={(e) => updateNode(activeNode.id, { handoverMessage: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-400/5 transition-all min-h-[140px] shadow-sm"
                            placeholder="e.g. Please wait, our agent will assist you shortly..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Trigger Configuration */}
                    {activeNode.data.type === 'trigger' && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-3 pl-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Activation Source</label>
                            {activeNode.data.triggerType === 'order_created' && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-full animate-pulse uppercase tracking-tight">⚡ WhatsApp Commerce Flow</span>
                            )}
                          </div>
                          <select
                            value={activeNode.data.triggerType || 'keyword'}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateNode(activeNode.id, { triggerType: val });
                              if (val === 'order_created' && nodes.length <= 1) {
                                generateCommerceTemplate();
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer appearance-none shadow-sm"
                          >
                            <option value="">Select Trigger...</option>
                            <option value="keyword">Keyword Matching (Inbound)</option>
                            {facebookInstagramConnected && (
                              <>
                                <option value="instagram_message">Instagram Message Received</option>
                                <option value="instagram_comment">Instagram Comment Received</option>
                                <option value="facebook_message">Facebook Message Received</option>
                              </>
                            )}
                            <option value="campaign">Campaign Reply Trigger</option>
                            <option value="contact">New Contact Added (Auto)</option>
                            {whatsappCommerceConnected && <option value="order_created">WhatsApp Order Created</option>}
                            {wooConnected && <option value="woocommerce">WooCommerce Order Created</option>}
                            {shopifyConnected && <option value="shopify">Shopify Order Created</option>}
                          </select>
                          {activeNode.data.triggerType === 'order_created' && (
                            <p className="text-[10px] text-blue-500 mt-2 px-1 font-medium italic">⚡ Hint: Auto-generated order flow template applied.</p>
                          )}
                        </div>

                        {['keyword', 'instagram_message', 'instagram_comment', 'facebook_message', ''].includes(activeNode.data.triggerType || '') && (
                          <div className="animate-in slide-in-from-top-2">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Target Keywords</label>

                            {/* Trigger Collision Notice */}
                            {keywordConflicts.length > 0 && (
                              <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm shrink-0">
                                  <FiAlertTriangle size={20} />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-[13px] font-bold text-red-800 tracking-tight">Active Collision</h4>
                                  <p className="text-[11px] text-red-600 font-medium leading-relaxed">
                                    Keywords are already active in flow: <span className="font-bold underline">"{keywordConflicts[0].flowName}"</span>. Pause it to avoid routing conflicts.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              {(activeNode.data.keywords || []).map((kw, i) => (
                                <div key={i} className="px-3 py-1.5 bg-white border border-blue-100 text-blue-700 text-[11px] font-semibold rounded-lg shadow-sm flex items-center gap-2">
                                  {kw}
                                  <FiX
                                    size={10}
                                    className="cursor-pointer opacity-50 hover:opacity-100"
                                    onClick={() => {
                                      const keywords = [...(activeNode.data.keywords || [])];
                                      keywords.splice(i, 1);
                                      updateNode(activeNode.id, { keywords });
                                      checkConflicts(keywords);
                                    }}
                                  />
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  setNewKeywordInput("");
                                  setShowKeywordModal(true);
                                }}
                                className="px-3 py-1.5 border border-dashed border-slate-300 text-slate-400 rounded-lg text-[11px] font-semibold hover:border-blue-500 hover:text-blue-500 transition-all"
                              >
                                + Add Keyword
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 px-1 italic">Note: Triggers when user message matches any of these (case-insensitive).</p>
                          </div>
                        )}

                        {activeNode.data.triggerType === 'campaign' && (
                          <div className="animate-in slide-in-from-top-2 space-y-4">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest pl-1">Target Campaign</label>
                            <select
                              value={activeNode.data.campaignId || ''}
                              onChange={(e) => updateNode(activeNode.id, { campaignId: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-sm appearance-none"
                            >
                              <option value="">Select a Campaign...</option>
                              {campaigns.map(c => (
                                <option key={c._id} value={c._id}>{c.name || 'Unnamed Campaign'}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400 px-1 italic font-medium">Triggered when a user replies to any message from this specific campaign.</p>
                          </div>
                        )}

                        {activeNode.data.triggerType === 'contact' && (
                          <div className="animate-in slide-in-from-top-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                              <FiSettings size={20} />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-[12px] font-semibold text-emerald-800">Auto Welcome</h4>
                              <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                                This flow will trigger automatically as soon as a new contact is added to your system via WhatsApp inbound or import.
                              </p>
                            </div>
                          </div>
                        )}

                        {activeNode.data.triggerType === 'shopify' && (
                          <div className="animate-in slide-in-from-top-2 space-y-4">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest pl-1">Shopify Event</label>
                            <select
                              value={activeNode.data.shopifyEvent || 'order_created'}
                              onChange={(e) => updateNode(activeNode.id, { shopifyEvent: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                            >
                              <option value="order_created">New Order Created</option>
                              <option value="abandoned_cart">Abandoned Checkout/Cart</option>
                            </select>
                            <p className="text-[10px] text-slate-400 px-1 italic">Note: Ensure Shopify integration is connected in settings.</p>
                          </div>
                        )}

                        {/* WooCommerce Trigger Configuration */}
                        {activeNode.data.triggerType === 'woocommerce' && (
                          <div className="animate-in slide-in-from-top-2 space-y-4">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest pl-1">WooCommerce Event</label>
                            <select
                              value={activeNode.data.wooEvent || 'order_created'}
                              onChange={(e) => updateNode(activeNode.id, { wooEvent: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                            >
                              <option value="order_created">New Order Created</option>
                            </select>
                            <p className="text-[10px] text-slate-400 px-1 italic">Note: Ensure WooCommerce plugin is configured.</p>
                          </div>
                        )}

                        {/* Cooldown Configuration */}
                        <div className="pt-4 border-t border-slate-100">
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 pl-1">Cooldown Period (Hours)</label>
                          <input
                            type="number"
                            min="0"
                            value={activeNode.data.cooldownHours || 0}
                            onChange={(e) => updateNode(activeNode.id, { cooldownHours: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                            placeholder="0 (Trigger every time)"
                          />
                          <p className="text-[10px] text-slate-400 mt-2 px-1 font-medium italic">If set to &gt; 0, the flow will not trigger again for the same user within this timeframe.</p>
                        </div>
                      </div>
                    )}

                    <div className="pt-8 border-t border-slate-100 space-y-3">
                      <button
                        onClick={() => duplicateNode(activeNode.id)}
                        className="w-full py-4 px-6 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-[12px] font-semibold uppercase tracking-[0.1em] transition-all border border-slate-100 flex items-center justify-center gap-2"
                      >
                        <FiCopy size={16} /> Duplicate Step
                      </button>
                      <button
                        onClick={() => deleteNode(activeNode.id)}
                        className="w-full py-4 px-6 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-2xl text-[12px] font-semibold uppercase tracking-[0.1em] transition-all border border-red-100 flex items-center justify-center gap-2"
                      >
                        <FiTrash2 size={16} /> Delete Step
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Keyword Entry Modal (Replaces Browser Prompt) */}
      {showKeywordModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Blur Backdrop */}
          <div
            className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowKeywordModal(false)}
          />

          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100">
              <div className="flex flex-col gap-1">
                <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight">Add Keyword</h3>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Inbound Trigger Keyword</p>
              </div>
              <button
                onClick={() => setShowKeywordModal(false)}
                className="p-2.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-all"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Input Area */}
            <div className="p-7 space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
                    <FiTarget size={18} />
                  </div>
                  <input
                    autoFocus
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newKeywordInput.trim()) {
                        const keywords = [...(activeNode.data.keywords || []), newKeywordInput.trim()];
                        updateNode(activeNode.id, { keywords });
                        setShowKeywordModal(false);
                      }
                    }}
                    placeholder="e.g. Help, Pricing, Menu"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] pl-11 pr-5 py-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium px-1 leading-relaxed">
                  Triggers are case-insensitive. Your bot will fire when a user sends exactly this word.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowKeywordModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[13px] font-semibold rounded-[20px] transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newKeywordInput.trim()) {
                      const keywords = [...(activeNode.data.keywords || []), newKeywordInput.trim()];
                      updateNode(activeNode.id, { keywords });
                      setShowKeywordModal(false);
                    }
                  }}
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-[20px] shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FiPlus size={18} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================= BULK PASTE MODAL ================= */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowPasteModal(false)} />
          <div className="relative bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
              <div>
                <h3 className="text-xl font-bold">Auto-fill Body Variables</h3>
                <p className="text-xs font-medium text-white/80 mt-1 uppercase tracking-widest">Paste multi-line content to map</p>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                <FiX size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Paste Content Here</label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full h-[200px] bg-slate-50 border-none rounded-[24px] p-6 text-[14px] font-medium text-slate-700 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none transition-all"
                  placeholder="Line 1 -> {{1}}&#10;Line 2 -> {{2}}&#10;Line 3 -> {{3}}"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    const lines = pasteContent.split('\n').filter(l => l.trim());
                    const variables = { ...(activeNode.data.variables || {}) };
                    lines.forEach((line, idx) => {
                      variables[(idx + 1).toString()] = line.trim();
                    });
                    updateNode(activeNode.id, { variables });
                    setShowPasteModal(false);
                    setPasteContent('');
                    nicePrompt.success("Variables Mapped", `${lines.length} variables have been auto-filled.`);
                  }}
                  className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[20px] shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-[13px]"
                >
                  <FiCheck size={18} /> Map Variables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FlowBuilderWrapper = () => (
  <ReactFlowProvider>
    <FlowBuilder />
  </ReactFlowProvider>
);

export default FlowBuilderWrapper;
