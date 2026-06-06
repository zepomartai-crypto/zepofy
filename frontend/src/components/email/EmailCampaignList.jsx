import React, { useState } from 'react';
import api from '../../api/api';
import { FiEye, FiEdit2, FiTrash2, FiMoreVertical } from 'react-icons/fi';

export default function EmailCampaignList({ campaigns, onEdit, onRefresh, onView, onDelete }) {
  const [runningCampaigns, setRunningCampaigns] = useState(new Set());
  const [showDropdown, setShowDropdown] = useState(null);

  const handleRunCampaign = async (campaignId) => {
    if (runningCampaigns.has(campaignId)) return;

    try {
      setRunningCampaigns(prev => new Set(prev).add(campaignId));
      
      const response = await api.post(`/email-campaigns/${campaignId}/run`);
      
      if (response.data.success) {
        onRefresh && onRefresh();
      } else {
        alert(response.data.message || 'Failed to run campaign');
      }
    } catch (error) {
      console.error('Run campaign error:', error);
      alert(error.response?.data?.message || 'Failed to run campaign');
    } finally {
      setRunningCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/email-campaigns/${campaignId}`);
      
      if (response.data.success) {
        onRefresh && onRefresh();
      } else {
        alert(response.data.message || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Delete campaign error:', error);
      alert(error.response?.data?.message || 'Failed to delete campaign');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'running': return 'bg-orange-100 text-orange-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'scheduled': return 'Scheduled';
      case 'running': return 'Running';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  if (!campaigns.length) {
    return (
      <div className="bg-white rounded-lg shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-12 text-center">
        <div className="text-gray-500">
          <div className="text-4xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">No Email Campaigns</h3>
          <p className="text-sm">Create your first email campaign to get started</p>
          <p className="text-xs mt-2 text-amber-600">
            Note: Email campaigns will be available once SMTP is configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Email Campaign List</h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {campaigns.map((campaign) => (
          <div key={campaign._id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-base font-medium text-gray-900">{campaign.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                    {getStatusText(campaign.status)}
                  </span>
                </div>
                
                {campaign.subject && (
                  <p className="text-sm text-gray-600 mb-2">
                    Subject: {campaign.subject}
                  </p>
                )}
                
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <span>From: {campaign.fromEmail || 'Not set'}</span>
                  <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                  {campaign.scheduledAt && (
                    <span>Scheduled: {new Date(campaign.scheduledAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {/* View Button */}
                <button
                  onClick={() => onView && onView(campaign)}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View Campaign"
                >
                  <FiEye className="w-4 h-4" />
                </button>

                {/* Edit Button - Show for draft campaigns */}
                {campaign.status === 'draft' && (
                  <button
                    onClick={() => onEdit && onEdit(campaign)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit Campaign"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                )}

                {/* Actions Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(showDropdown === campaign._id ? null : campaign._id)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    title="More Actions"
                  >
                    <FiMoreVertical className="w-4 h-4" />
                  </button>

                  {showDropdown === campaign._id && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="py-1">
                        {/* Run/Retry Button */}
                        {(campaign.status === 'draft' || campaign.status === 'failed') && (
                          <button
                            onClick={() => {
                              handleRunCampaign(campaign._id);
                              setShowDropdown(null);
                            }}
                            disabled={runningCampaigns.has(campaign._id)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                              runningCampaigns.has(campaign._id)
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {runningCampaigns.has(campaign._id) ? (
                              <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                <span>Running...</span>
                              </>
                            ) : (
                              <>
                                <span>{campaign.status === 'failed' ? '🔄' : '▶️'}</span>
                                <span>{campaign.status === 'failed' ? 'Retry' : 'Run'}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => {
                            handleDeleteCampaign(campaign._id);
                            setShowDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <FiTrash2 className="w-4 h-4" />
                          <span>Delete Campaign</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}