import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { useAuth } from './useAuth';

const IntegrationContext = createContext();

export const IntegrationProvider = ({ children }) => {
    const [whatsappConnected, setWhatsappConnected] = useState(false);
    const [whatsappCommerceConnected, setWhatsappCommerceConnected] = useState(false);
    const [wooConnected, setWooConnected] = useState(false);
    const [shopifyConnected, setShopifyConnected] = useState(false);
    const [catalogConnected, setCatalogConnected] = useState(false);
    const [facebookInstagramConnected, setFacebookInstagramConnected] = useState(false);
    const [aiConnected, setAiConnected] = useState(false);
    const [catalogId, setCatalogId] = useState(null);
    const [storeUrl, setStoreUrl] = useState('');
    const [loading, setLoading] = useState(true);

    const auth = useAuth();

    const fetchStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        
        // If we don't have a token or user, we can't fetch. 
        // Reset and stop.
        if (!token && !auth?.user) {
            setWhatsappConnected(false);
            setCatalogConnected(false);
            setFacebookInstagramConnected(false);
            setWooConnected(false);
            setShopifyConnected(false);
            setAiConnected(false);
            setLoading(false);
            return;
        }

        // Reset loading to true when starting a fetch
        setLoading(true);

        // Wait for auth loading to finish ONLY if we don't have a user object yet
        if (auth?.loading && !auth?.user) {
             return;
        }

        try {
            console.log("🔄 Fetching integration status...");
            const [statusRes, aiRes] = await Promise.all([
                api.get('/integrations/status'),
                api.get('/ai-integration/settings').catch(() => ({ data: { success: false } }))
            ]);
            
            if (statusRes.data.success && statusRes.data.data) {
                const { whatsapp, whatsappCommerce, woocommerce, shopify, facebook_instagram } = statusRes.data.data;
                
                setWhatsappConnected(whatsapp?.connected || false);
                setWhatsappCommerceConnected(whatsappCommerce?.connected || false);
                setCatalogConnected(whatsapp?.catalogConnected || false);
                setCatalogId(whatsapp?.catalogId || null);
                setWooConnected(woocommerce?.connected || false);
                setShopifyConnected(shopify?.connected || false);
                setFacebookInstagramConnected(facebook_instagram?.connected || false);

                const url = woocommerce?.storeUrl || shopify?.storeUrl || null;
                setStoreUrl(url);
            }

            if (aiRes.data.success && aiRes.data.settings) {
                // AI is ACTIVE only if it has a key and is enabled
                setAiConnected(aiRes.data.settings.hasKey && aiRes.data.settings.enabled);
            }
        } catch (error) {
            console.error('❌ Integration sync failed:', error);
            if (error.response?.status === 401) {
                setWhatsappConnected(false);
                setWooConnected(false);
                setShopifyConnected(false);
                setFacebookInstagramConnected(false);
                setAiConnected(false);
            }
        } finally {
            setLoading(false);
        }
    }, [auth?.user, auth?.loading]);

    // Force fetch whenever auth.user changes (Login/Logout) or on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token || auth?.user) {
            fetchStatus();
        } else {
            setLoading(false);
        }
    }, [auth?.user, auth?.loading, fetchStatus]);

    const refreshIntegrations = useCallback(async () => {
        await fetchStatus();
    }, [fetchStatus]);

    // Simple helper to update a single flag instantly
    const setIntegrationStatus = (key, value) => {
        if (key === 'whatsapp') setWhatsappConnected(value);
        if (key === 'woocommerce') setWooConnected(value);
        if (key === 'shopify') setShopifyConnected(value);
        if (key === 'facebook_instagram') setFacebookInstagramConnected(value);
    };

    return (
        <IntegrationContext.Provider value={{
            whatsappConnected,
            whatsappCommerceConnected,
            catalogConnected,
            catalogId,
            wooConnected,
            shopifyConnected,
            facebookInstagramConnected,
            aiConnected,
            storeUrl,
            loading,
            refreshIntegrations,
            refreshStatus: refreshIntegrations, // Compatibility alias
            setIntegrationStatus
        }}>
            {children}
        </IntegrationContext.Provider>
    );
};

export const useIntegration = () => {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error('useIntegration must be used within an IntegrationProvider');
    }
    return context;
};
