import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { 
  ArrowLeft, Save, Layout, Type, List, CheckSquare, 
  ChevronDown, Calendar, Settings, Plus, Trash2, Copy, 
  GripVertical, Menu, Hash, Mail, Lock, Key, Phone, 
  Image as ImageIcon, UploadCloud, CheckCircle2,
  Box, X, AlignLeft, Search, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

const COMPONENT_TYPES = [
  { id: 'Input', label: 'Input', icon: Type, defaultProps: { label: 'Input', required: false, placeholder: 'Kindly Enter Text' } },
  { id: 'Number', label: 'Number', icon: Hash, defaultProps: { label: 'Number', required: false, placeholder: 'Enter Number' } },
  { id: 'Email', label: 'Email', icon: Mail, defaultProps: { label: 'Email', required: false, placeholder: 'Enter Email' } },
  { id: 'Password', label: 'Password', icon: Lock, defaultProps: { label: 'Password', required: false, placeholder: 'Enter Password' } },
  { id: 'Passcode', label: 'Passcode', icon: Key, defaultProps: { label: 'Passcode', required: false, placeholder: 'Enter Passcode' } },
  { id: 'Phone', label: 'Phone', icon: Phone, defaultProps: { label: 'Phone Number', required: false, placeholder: 'Enter Phone Number' } },
  { id: 'Textarea', label: 'Textarea', icon: AlignLeft, defaultProps: { label: 'Textarea', required: false, placeholder: 'Enter Long Text' } },
  { id: 'Checkbox', label: 'Checkbox', icon: CheckSquare, defaultProps: { label: 'Checkbox', options: ['Option 1'], required: false } },
  { id: 'Dropdown', label: 'Dropdown', icon: ChevronDown, defaultProps: { label: 'Dropdown', options: ['Option 1'], required: false } },
  { id: 'Radio', label: 'Radio', icon: CheckCircle2, defaultProps: { label: 'Radio', options: ['Option 1'], required: false } },
  { id: 'Date', label: 'Date', icon: Calendar, defaultProps: { label: 'Date', required: false, placeholder: 'Select Date' } },
  { id: 'Optin', label: 'Optin', icon: CheckSquare, defaultProps: { label: 'Optin', required: false } },
  { id: 'ImageUpload', label: 'Image Upload', icon: ImageIcon, defaultProps: { label: 'Image Upload', required: false } },
  { id: 'FileUpload', label: 'File Upload', icon: UploadCloud, defaultProps: { label: 'File Upload', required: false } },
];

export default function WhatsAppFlowBuilder() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  
  const [activeLeftTab, setActiveLeftTab] = useState('Components'); // Flow Meta, Screens, Components
  
  // Flow Meta State
  const [flowName, setFlowName] = useState('Welcome Flow');
  const [category, setCategory] = useState('');
  const [whatsappChannel, setWhatsappChannel] = useState('');
  
  const [screens, setScreens] = useState([
    { id: 'screen_1', name: 'Welcome Screen', components: [] }
  ]);
  const [activeScreenId, setActiveScreenId] = useState('screen_1');
  const [selectedComponentId, setSelectedComponentId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/whatsapp-flows/${flowId}`);
        const flowData = res.data.data;
        if (flowData) {
          setFlowName(flowData.name || '');
          setCategory(flowData.categories?.[0] || '');
          setWhatsappChannel(flowData.whatsappChannel || '');
          if (flowData.layout && flowData.layout.screens && flowData.layout.screens.length > 0) {
            setScreens(flowData.layout.screens);
            setActiveScreenId(flowData.layout.screens[0].id);
          }
        }
        
        try {
          const chanRes = await api.get("/whatsapp-flows/integrations");
          setChannels(chanRes.data.data || []);
        } catch (err) {
          console.error("Failed to load integrations:", err);
        }
        
      } catch (err) {
        console.error('Failed to load flow:', err);
        toast.error('Failed to load flow data');
      } finally {
        setLoading(false);
      }
    };
    if (flowId) fetchFlow();
  }, [flowId]);

  const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];
  const selectedComponent = activeScreen?.components?.find(c => c.id === selectedComponentId);

  const handleAddComponent = (type) => {
    const compDef = COMPONENT_TYPES.find(t => t.id === type);
    const newComponent = {
      id: `comp_${Date.now()}`,
      type,
      ...compDef.defaultProps
    };
    
    setScreens(screens.map(s => {
      if (s.id === activeScreenId) {
        return { ...s, components: [...(s.components || []), newComponent] };
      }
      return s;
    }));
    setSelectedComponentId(newComponent.id);
  };

  const handleUpdateComponent = (updates) => {
    setScreens(screens.map(s => {
      if (s.id === activeScreenId) {
        return {
          ...s,
          components: s.components.map(c => c.id === selectedComponentId ? { ...c, ...updates } : c)
        };
      }
      return s;
    }));
  };

  const handleDeleteComponent = (id) => {
    setScreens(screens.map(s => {
      if (s.id === activeScreenId) {
        return { ...s, components: s.components.filter(c => c.id !== id) };
      }
      return s;
    }));
    if (selectedComponentId === id) setSelectedComponentId(null);
  };

  const handleDuplicateComponent = (comp) => {
    const newComp = { ...comp, id: `comp_${Date.now()}` };
    setScreens(screens.map(s => {
      if (s.id === activeScreenId) {
        const idx = s.components.findIndex(c => c.id === comp.id);
        const newComps = [...s.components];
        newComps.splice(idx + 1, 0, newComp);
        return { ...s, components: newComps };
      }
      return s;
    }));
    setSelectedComponentId(newComp.id);
  };

  const saveFlow = async (applyToMeta = false) => {
    if (saving) return;
    try {
      setSaving(true);
      await api.put(`/whatsapp-flows/${flowId}`, {
        name: flowName,
        categories: category ? [category] : [],
        whatsappChannel,
        layout: { screens }
      });
      
      if (applyToMeta) {
        toast.success('Flow saved. Syncing with Meta...');
        await api.post(`/whatsapp-flows/${flowId}/sync`);
        toast.success('Sent to Meta for Approval successfully! (Pending)');
      } else {
        toast.success('Flow saved to Draft successfully!');
      }
      
      setTimeout(() => {
        navigate('/automation/whatsapp-flows');
      }, 1000);
      
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.message || 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#f0f2f5]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]"></div></div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#f0f2f5] font-sans overflow-hidden">
      {/* Top Navbar */}
      <div className="h-[60px] shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/automation/whatsapp-flows')}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 text-slate-500 rounded-full transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => saveFlow(false)} disabled={saving} className="px-5 h-9 text-[13px] font-semibold text-[#00a884] border border-[#00a884] rounded-lg hover:bg-[#00a884] hover:text-white transition-colors flex items-center gap-2 bg-white">
            <Save size={16} /> Save
          </button>
          <button onClick={() => saveFlow(true)} disabled={saving} className="px-5 h-9 text-[13px] font-semibold text-white bg-[#00a884] rounded-lg hover:bg-[#008f6f] transition-colors flex items-center gap-2">
            <CheckCircle2 size={16} /> Apply to Meta
          </button>
          <button onClick={() => navigate('/automation/whatsapp-flows')} className="px-5 h-9 text-[13px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 ml-2">
            <X size={16} /> Close
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR: Tabs & Elements */}
        <div className="w-[340px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-slate-200 p-2 gap-2">
            {['Flow Meta', 'Screens', 'Components'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveLeftTab(tab)}
                className={`flex-1 py-2 text-[13px] font-semibold rounded-md transition-colors ${activeLeftTab === tab ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {activeLeftTab === 'Flow Meta' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Flow Name</label>
                  <input 
                    type="text" 
                    value={flowName} 
                    onChange={(e) => setFlowName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-800 focus:border-[#00a884] outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-800 focus:border-[#00a884] outline-none"
                  >
                    <option value="">Select Category</option>
                    <option value="Lead Generation">Lead Generation</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Survey">Survey</option>
                    <option value="Sign up">Sign up</option>
                    <option value="Sign in">Sign in</option>
                    <option value="Appointment Booking">Appointment Booking</option>
                    <option value="Contact Us">Contact Us</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Channel</label>
                  <select 
                    value={whatsappChannel}
                    onChange={(e) => setWhatsappChannel(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-800 focus:border-[#00a884] outline-none"
                  >
                    <option value="">Select Channel</option>
                    {channels.length === 0 ? (
                      <option disabled>No integrated channels found</option>
                    ) : (
                      channels.map(chan => (
                        <option key={chan} value={chan}>{chan}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )}

            {activeLeftTab === 'Screens' && (
              <div className="space-y-3">
                {screens.map((screen) => (
                  <div 
                    key={screen.id}
                    onClick={() => setActiveScreenId(screen.id)}
                    className={`cursor-pointer border ${activeScreenId === screen.id ? 'border-[#00a884] bg-green-50/30' : 'border-slate-200 hover:border-slate-300'} border-dashed rounded-lg p-3 flex items-center justify-between transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      <Layout size={16} className={activeScreenId === screen.id ? "text-[#00a884]" : "text-slate-400"} />
                      <span className={`text-sm font-semibold ${activeScreenId === screen.id ? 'text-slate-800' : 'text-slate-600'}`}>{screen.name}</span>
                    </div>
                    {activeScreenId === screen.id && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Settings size={14} className="hover:text-[#00a884] cursor-pointer" />
                        <Copy size={14} className="hover:text-[#00a884] cursor-pointer" />
                        <Trash2 
                          size={14} 
                          className="hover:text-red-500 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (screens.length === 1) {
                              toast.error("You must have at least one screen");
                              return;
                            }
                            if (window.confirm("Delete this screen?")) {
                              const newScreens = screens.filter(s => s.id !== screen.id);
                              setScreens(newScreens);
                              setActiveScreenId(newScreens[0].id);
                              setSelectedComponentId(null);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  onClick={() => {
                    const newId = `screen_${Date.now()}`;
                    setScreens([...screens, { id: newId, name: `Screen ${screens.length + 1}`, components: [] }]);
                    setActiveScreenId(newId);
                  }}
                  className="w-full py-3 border border-slate-200 border-dashed rounded-lg text-slate-500 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 transition-colors mt-4"
                >
                  <Plus size={16} /> Add Screen
                </button>
              </div>
            )}

            {activeLeftTab === 'Components' && (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Search Components" className="w-full h-10 pl-9 pr-4 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#00a884] outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {COMPONENT_TYPES.map(comp => (
                    <button
                      key={comp.id}
                      onClick={() => handleAddComponent(comp.id)}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-blue-100 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-100 transition-all text-[#1539C2]"
                    >
                      <comp.icon size={24} strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-slate-700">{comp.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MIDDLE CANVAS: iPhone Simulator */}
        <div className="flex-1 bg-white overflow-y-auto p-8 flex flex-col items-center custom-scrollbar relative">
          
          <div className="w-full max-w-[800px] mb-4 flex items-center justify-between">
             <h2 className="text-lg font-bold text-slate-700">{activeScreen.name} Preview</h2>
          </div>

          <div className="relative w-[340px] h-[680px] bg-black rounded-[45px] shadow-2xl p-[6px] shrink-0 border-[3px] border-slate-800">
            {/* Inner Phone Screen */}
            <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative flex flex-col">
              
              {/* iPhone Notch Area */}
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
                <div className="w-40 h-6 bg-black rounded-b-[16px]"></div>
              </div>

              {/* Status Bar Mock */}
              <div className="h-10 shrink-0 w-full flex justify-between items-center px-6 text-[10px] font-bold text-slate-800 pt-1 z-40 relative">
                <span>12:16 PM</span>
                <div className="flex gap-1.5 items-center">
                  <div className="w-4 h-2.5 bg-slate-800 rounded-sm"></div>
                </div>
              </div>

              {/* Form Content Scrollable */}
              <div className="flex-1 px-5 pt-2 pb-24 overflow-y-auto custom-scrollbar flex flex-col gap-4 relative">
                {activeScreen.components.map((comp) => (
                  <div 
                    key={comp.id}
                    onClick={() => setSelectedComponentId(comp.id)}
                    className={`relative cursor-pointer group ${comp.type === 'Heading' ? 'mb-2' : 'border-b border-slate-200 pb-3'}`}
                  >
                    {/* Hover Actions (Green icons) */}
                    <div className={`absolute right-0 top-0 hidden group-hover:flex items-center gap-1.5 bg-white shadow-sm rounded-md px-2 py-1 z-10 border border-slate-100 ${selectedComponentId === comp.id ? '!flex' : ''}`}>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedComponentId(comp.id); }} className="text-[#00a884] hover:text-[#008f6f]"><Settings size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicateComponent(comp); }} className="text-[#00a884] hover:text-[#008f6f]"><Copy size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteComponent(comp.id); }} className="text-[#e2b714] hover:text-yellow-600"><Trash2 size={14} /></button>
                    </div>

                    {comp.type === 'Heading' ? (
                      <h3 className="text-xl font-bold text-slate-800">{comp.label}</h3>
                    ) : (
                      <>
                        <label className="block text-[13px] font-semibold text-slate-800 mb-1">
                          {comp.label} {comp.required && <span className="text-red-500">*</span>}
                        </label>

                        {comp.type === 'Dropdown' ? (
                          <div className="flex items-center justify-between text-[13px] text-slate-500 mt-2 p-2 border border-slate-200 rounded-md">
                            <span>{comp.options?.[0] || 'Option 1'}</span>
                            <ChevronDown size={14} />
                          </div>
                        ) : comp.type === 'Radio' ? (
                          <div className="mt-2 space-y-2">
                            {comp.options?.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2 text-[13px] text-slate-600">
                                <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        ) : comp.type === 'Checkbox' ? (
                          <div className="mt-2 space-y-2">
                            {comp.options?.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2 text-[13px] text-slate-600">
                                <div className="w-4 h-4 rounded border border-slate-300"></div>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        ) : comp.type === 'Optin' ? (
                          <div className="mt-2 flex items-start gap-2 text-[13px] text-slate-600">
                            <div className="w-4 h-4 mt-0.5 rounded border border-slate-300 shrink-0"></div>
                            <span>I agree to receive messages</span>
                          </div>
                        ) : ['ImageUpload', 'FileUpload'].includes(comp.type) ? (
                          <div className="mt-2 h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 bg-slate-50">
                            {comp.type === 'ImageUpload' ? <ImageIcon size={20} /> : <UploadCloud size={20} />}
                          </div>
                        ) : comp.type === 'Textarea' ? (
                          <div className="text-[13px] text-slate-400 mt-1 pb-4">
                            {comp.placeholder}
                          </div>
                        ) : (
                          <div className="text-[13px] text-slate-400 mt-1">
                            {comp.placeholder}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Submit Button */}
              <div className="absolute bottom-6 left-5 right-5">
                <button className="w-full h-11 bg-[#00a884] text-white rounded-full font-bold text-[14px]">
                  Submit
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Properties Panel */}
        <div className="w-[320px] shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          {selectedComponent && !selectedComponent.isStatic ? (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <Settings size={16} className="text-[#00a884]" />
                <h2 className="text-sm font-bold text-slate-800">Properties</h2>
              </div>
              <div className="p-5 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Field Label</label>
                  <input
                    type="text"
                    value={selectedComponent.label || ''}
                    onChange={(e) => handleUpdateComponent({ label: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] font-medium focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition-colors"
                  />
                </div>
                
                {['Input', 'Number', 'Email', 'Password', 'Passcode', 'Phone', 'Textarea', 'Date'].includes(selectedComponent.type) && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Placeholder</label>
                    <input
                      type="text"
                      value={selectedComponent.placeholder || ''}
                      onChange={(e) => handleUpdateComponent({ placeholder: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] font-medium focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition-colors"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Required Field</label>
                  <div className="relative inline-block w-9 h-5 cursor-pointer" onClick={() => handleUpdateComponent({ required: !selectedComponent.required })}>
                    <div className={`absolute inset-0 rounded-full transition-all ${selectedComponent.required ? 'bg-[#00a884]' : 'bg-slate-200'}`}></div>
                    <div className={`absolute top-0.5 bottom-0.5 w-4 bg-white rounded-full transition-all shadow-sm ${selectedComponent.required ? 'left-4' : 'left-0.5'}`}></div>
                  </div>
                </div>

                {['Dropdown', 'Radio', 'Checkbox'].includes(selectedComponent.type) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Options</label>
                      <button 
                        onClick={() => handleUpdateComponent({ options: [...(selectedComponent.options || []), `Option ${(selectedComponent.options?.length || 0) + 1}`] })}
                        className="text-[10px] font-bold text-[#00a884] hover:text-[#008f6f] uppercase tracking-widest"
                      >
                        + Add Option
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(selectedComponent.options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <GripVertical size={14} className="text-slate-300 cursor-move" />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...selectedComponent.options];
                              newOpts[i] = e.target.value;
                              handleUpdateComponent({ options: newOpts });
                            }}
                            className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-[13px] font-medium focus:border-[#00a884] outline-none"
                          />
                          <button 
                            onClick={() => {
                              const newOpts = [...selectedComponent.options];
                              newOpts.splice(i, 1);
                              handleUpdateComponent({ options: newOpts });
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Box size={40} className="mb-4 opacity-50" strokeWidth={1} />
              <p className="text-sm font-medium">Select Component to Edit</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

