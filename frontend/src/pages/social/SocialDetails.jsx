import React from "react";
import dayjs from "dayjs";
import { FaInstagram, FaFacebookMessenger, FaUser, FaClock } from "react-icons/fa";

export default function SocialDetails({ activeConv }) {
  if (!activeConv) {
    return (
      <div className="w-1/4 border-l border-gray-200 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No details available</p>
      </div>
    );
  }

  return (
    <div className="w-1/4 border-l border-gray-200 bg-white flex flex-col items-center py-8 px-4 h-full">
      <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden shadow-sm flex items-center justify-center border-4 border-white shadow-md">
        {activeConv.profilePicture ? (
          <img src={activeConv.profilePicture} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-gray-500">{(activeConv.customerName || "U")[0].toUpperCase()}</span>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-800 text-center mb-1">
        {(!activeConv.customerName || activeConv.customerName === "Unknown User") ? activeConv.customerId : activeConv.customerName}
      </h2>
      <p className="text-gray-500 text-sm mb-6 text-center select-all">
        {(!activeConv.customerName || activeConv.customerName === "Unknown User") ? "Customer ID" : `@${activeConv.customerId}`}
      </p>

      <div className="w-full space-y-4 border-t border-gray-100 pt-6">
        <div className="flex items-center text-gray-700">
          <div className="w-8 flex justify-center text-gray-400">
            {activeConv.platform === "instagram" ? <FaInstagram className="text-pink-500" /> : <FaFacebookMessenger className="text-blue-500" />}
          </div>
          <div className="ml-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Platform</p>
            <p className="text-sm font-medium capitalize">{activeConv.platform}</p>
          </div>
        </div>

        <div className="flex items-center text-gray-700">
          <div className="w-8 flex justify-center text-gray-400">
            <FaUser />
          </div>
          <div className="ml-3 w-full">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Customer ID</p>
            <p className="text-[13px] font-medium break-all select-all">{activeConv.customerId}</p>
          </div>
        </div>

        <div className="flex items-center text-gray-700">
          <div className="w-8 flex justify-center text-gray-400">
            <FaClock />
          </div>
          <div className="ml-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">First Interacted</p>
            <p className="text-sm font-medium">
              {activeConv.createdAt ? dayjs(activeConv.createdAt).format("MMM D, YYYY") : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
