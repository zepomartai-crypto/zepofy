
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, ShoppingCart, User, CreditCard, ExternalLink, Calendar, MapPin, Phone, Mail } from 'lucide-react';

const AbandonedCartDetailModal = ({ cartId, onClose }) => {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Add/remove modal-open class to body
    useEffect(() => {
        document.body.classList.add('modal-open');
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, []);

    // Fetch cart details
    useEffect(() => {
        const fetchCartDetails = async () => {
            if (!cartId) return;

            try {
                setLoading(true);
                // Ensure we use the MongoDB _id here (cartId prop should be the _id)
                const response = await axios.get(`/api/abandoned-carts/${cartId}`);

                if (response.data.success) {
                    setCart(response.data.data);
                } else {
                    setError(response.data.error || 'Failed to load cart details');
                }
            } catch (err) {
                console.error('Error fetching cart details:', err);
                setError(err.response?.data?.error || 'Failed to load cart details');
            } finally {
                setLoading(false);
            }
        };

        fetchCartDetails();
    }, [cartId]);

    if (!cartId) return null;

    return (
        <>
            <style>
                {`
          .modal-open {
            overflow: hidden;
          }
          .modal-overlay {
            position: fixed;
            inset: 0;
            backdrop-filter: blur(6px); /* BLUR EFFECT */
            background: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
          }
          .modal-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            z-index: 1001;
            animation: slideUp 0.3s ease-out;
            border: 1px solid #e5e7eb;
          }
          .dark .modal-content {
            background: #1f2937;
            border-color: #374151;
            color: #f3f4f6;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
            </style>

            <div className="modal-overlay" onClick={onClose} aria-modal="true" role="dialog">
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                                Abandoned Cart Details
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                ID: {cartId}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                {error}
                            </div>
                        ) : cart ? (
                            <div className="space-y-8">

                                {/* Customer Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-[12px] border border-gray-100 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <User className="w-4 h-4 text-indigo-500" />
                                            Customer Information
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-start gap-3">
                                                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <div>
                                                    <span className="block text-gray-500 dark:text-gray-400 text-xs">Name</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-200">{cart.customer_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <div>
                                                    <span className="block text-gray-500 dark:text-gray-400 text-xs">Email</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-200">{cart.customer_email}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <div>
                                                    <span className="block text-gray-500 dark:text-gray-400 text-xs">Phone</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-200">{cart.customer_phone || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Payment Info */}
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-[12px] border border-gray-100 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-blue-500" />
                                            Payment Details
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                                                <span className="text-gray-500 dark:text-gray-400">Total Amount</span>
                                                <span className="font-bold text-gray-900 dark:text-white text-lg">
                                                    {cart.currency} {parseFloat(cart.total_amount).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-gray-500 dark:text-gray-400">Status</span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                          ${cart.status === 'recovered' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        cart.status === 'abandoned' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                    {cart.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-gray-500 dark:text-gray-400">Abandoned At</span>
                                                <span className="text-gray-900 dark:text-gray-200 text-right">
                                                    {new Date(cart.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            {cart.payment_url && (
                                                <a
                                                    href={cart.payment_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md text-white rounded-lg transition-colors text-sm font-medium"
                                                >
                                                    Checkout Link <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Cart Items */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                        Cart Items ({cart.cart_items?.length || 0})
                                    </h3>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-[12px] overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                                                <tr>
                                                    <th className="px-4 py-3">Product</th>
                                                    <th className="px-4 py-3 text-center">Quantity</th>
                                                    <th className="px-4 py-3 text-right">Price</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {cart.cart_items?.map((item, index) => (
                                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs truncate">
                                                            {item.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                                                            {cart.currency} {item.price}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                            {cart.currency} {item.total}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end rounded-b-xl">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AbandonedCartDetailModal;
