import React, { createContext, useContext, useState } from "react";

const FlowContext = createContext(null);
export const useFlow = () => useContext(FlowContext);

export const FlowProvider = ({ children }) => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [connecting, setConnecting] = useState(null); // { sourceId, buttonIndex }

  const addNode = (block) => {
    const node = {
      id: Date.now().toString(),
      type: block.type,
      label: block.label,
      x: 300 + Math.floor(Math.random() * 160),
      y: 120 + Math.floor(Math.random() * 120),
      data: { text: block.type === "text" ? "New message..." : "", caption: "", buttons: [], mediaUrl: null, mediaFilename: null },
      next: {}
    };
    setNodes((p) => [...p, node]);
    setActiveNodeId(node.id);
  };

  const removeNode = (id) => {
    setNodes((p) => p.filter((n) => n.id !== id));
    setConnections((p) => p.filter((c) => c.source !== id && c.target !== id));
    if (activeNodeId === id) setActiveNodeId(null);
  };

  const updateNode = (id, patch) => {
    setNodes((p) => p.map((n) => (n.id === id ? { ...n, ...patch, data: { ...n.data, ...(patch.data || {}) } } : n)));
  };

  const beginConnect = (sourceId, buttonIndex) => {
    setConnecting({ sourceId, buttonIndex });
  };

  const finishConnect = (targetId) => {
    if (!connecting) return;
    const { sourceId, buttonIndex } = connecting;

    const newConn = { source: sourceId, sourceButtonIndex: buttonIndex, target: targetId };
    setConnections((p) => [...p, newConn]);
    setNodes((p) => p.map((n) => (n.id === sourceId ? { ...n, next: { ...(n.next || {}), [buttonIndex]: targetId } } : n)));
    setConnecting(null);
  };

  return (
    <FlowContext.Provider
      value={{
        nodes,
        setNodes,
        connections,
        setConnections,
        activeNodeId,
        setActiveNodeId,
        addNode,
        removeNode,
        updateNode,
        beginConnect,
        finishConnect,
        connecting,
      }}
    >
      {children}
    </FlowContext.Provider>
  );
};
