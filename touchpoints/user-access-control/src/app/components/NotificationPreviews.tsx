import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info } from 'lucide-react';
import { NotificationCard } from './NotificationCard';
import type { AppNotification } from './notificationsData';
import svgPaths from '../../imports/svg-35mt3yogo8';
import pushSvgPaths from '../../imports/svg-ubs45aykck';
import imgScreenshot from "@/assets/9d85577000e1f4ba96b2aac00847f23f4a09c66c.png";
import imgIPhone14Pro2 from "@/assets/c5454dd63c2c3f96a720608d964ba3c04fcaa97f.png";

export type NotificationType = 'email' | 'push' | 'in-app' | null;

export interface AlertPreviewData {
  emailSubject: string;
  emailBody: string;
  pushText: string;
  inAppTitle: string;
  inAppText: string;
}

export interface AlertData {
  id: number;
  title: string;
  description: string;
  preview?: AlertPreviewData;
}

interface NotificationPreviewsProps {
  type: NotificationType;
  onClose: () => void;
  alert?: AlertData;
}

// Default preview data if none is provided (fallback)
const DEFAULT_PREVIEW: AlertPreviewData = {
  emailSubject: "Role Removed: Purchasing Agent",
  emailBody: "Your Purchasing Agent role has been removed by an administrator. You may no longer have access to features and modules associated with this role. If you believe this was done in error, contact your administrator.",
  pushText: "Purchasing Agent role removed from your profile.",
  inAppTitle: "Role Removed",
  inAppText: "Your Purchasing Agent role has been removed. You may no longer have permissions associated with this role."
};

export const NotificationPreviews: React.FC<NotificationPreviewsProps> = ({ type, onClose, alert }) => {
  const previewData = alert?.preview || DEFAULT_PREVIEW;

  return (
    <AnimatePresence>
      {type === 'email' && (
        <EmailPreviewModal onClose={onClose} data={previewData} />
      )}
      {type === 'in-app' && (
        <InAppPreviewModal onClose={onClose} data={previewData} />
      )}
      {type === 'push' && (
        <PushPreviewModal onClose={onClose} data={previewData} />
      )}
    </AnimatePresence>
  );
};

interface ModalWrapperProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  maxWidth?: string;
}

const ModalWrapper = ({ children, title, onClose, maxWidth = "max-w-2xl" }: ModalWrapperProps) => createPortal(
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: 10 }}
      transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
      className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh]`}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Content Area - Slate Background */}
      <div className="p-8 bg-[#fafbfc] overflow-y-auto flex-1 flex flex-col items-center">
        {children}
      </div>
    </motion.div>
  </motion.div>,
  document.body
);

const EmailPreviewModal = ({ onClose, data }: { onClose: () => void, data: AlertPreviewData }) => (
  <ModalWrapper title="Preview For Email Notification" onClose={onClose}>
     <div className="w-full max-w-2xl mx-auto">
         {/* Email Card */}
         <div className="bg-white rounded-xl overflow-hidden w-full border border-[#f5f5f5]" style={{ boxShadow: '0px 4px 6px 0px rgba(16,24,40,0.1), 0px 2px 4px 0px rgba(16,24,40,0.1)' }}>
             {/* Header - Sender Info */}
             <div className="flex items-center px-5 py-4 border-b border-[#eaebf0]">
               <div className="shrink-0 w-10 h-10 mr-3">
                 <svg className="block w-10 h-10" fill="none" viewBox="0 0 40 40">
                   <path d={svgPaths.p3c12f200} fill="#ECF4FC" />
                   <path d={svgPaths.p243b6400} fill="#0A77FF" />
                 </svg>
               </div>
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-1">
                   <span className="text-[#1f1f1f] text-sm" style={{ fontWeight: 700 }}>Omne</span>
                   <span className="text-[#5e5e5e] text-xs">&lt;notifications@omnesoft.com&gt;</span>
                 </div>
                 <div className="flex items-center gap-1">
                   <span className="text-[#5e5e5e] text-xs">to me</span>
                   <svg className="w-3 h-3 opacity-70" viewBox="0 0 12 12" fill="none">
                     <path d="M3 4.5L6 7.5L9 4.5" stroke="#5e5e5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </div>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                 <div className="bg-[#f5f5f5] flex items-center justify-center rounded-md w-8 h-8">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20">
                     <path d={svgPaths.p2b3cab00} fill="#444444" />
                   </svg>
                 </div>
                 <div className="bg-[#f5f5f5] flex items-center justify-center rounded-md w-8 h-8">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20">
                     <path d="M10 2L12.09 7.26L18 7.64L13.45 11.22L14.82 17L10 14.27L5.18 17L6.55 11.22L2 7.64L7.91 7.26L10 2Z" stroke="#444444" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
                   </svg>
                 </div>
                 <div className="bg-[#f5f5f5] flex items-center justify-center rounded-md w-8 h-8">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20">
                     <path d={svgPaths.p8457c40} fill="#444746" />
                   </svg>
                 </div>
               </div>
             </div>

             {/* Email Body */}
             <div className="flex flex-col gap-4 p-5" style={{ whiteSpace: 'pre-wrap' }}>
               <p className="text-[#252525] tracking-[-0.2px] text-sm" style={{ fontWeight: 600, lineHeight: 'normal' }}>{data.emailSubject}</p>
               <p className="text-[#68727d] text-[13px]" style={{ lineHeight: '20px' }}>Hi,</p>
               <p className="text-[#68727d] text-[13px]" style={{ lineHeight: '20px' }}>{data.emailBody}</p>
               <p className="text-[#68727d] text-[13px]" style={{ lineHeight: '20px' }}>If you have any questions, please contact our support team.</p>
             </div>

             {/* Footer */}
             <div className="flex items-center justify-between px-5 pt-4 pb-5 border-t border-[#eaebf0]">
               <div className="flex items-center gap-1.5">
                 <svg className="w-5 h-5 opacity-50" viewBox="0 0 20 20" fill="none">
                   <path d="M18 5H2C1.45 5 1 5.45 1 6V14C1 14.55 1.45 15 2 15H18C18.55 15 19 14.55 19 14V6C19 5.45 18.55 5 18 5ZM18 14H2V6L10 10.88L18 6V14ZM10 9.12L2 4.25V4H18V4.25L10 9.12Z" fill="#5e5e5e"/>
                 </svg>
                 <span className="text-[#5e5e5e] text-xs">2:11 PM (1 minute ago)</span>
               </div>
               <div className="flex items-center gap-4">
                 {/* X / Twitter */}
                 <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                   <path clipRule="evenodd" d={svgPaths.p39d15480} fill="#A1A4AC" fillRule="evenodd" />
                 </svg>
                 {/* Facebook */}
                 <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                   <path d={svgPaths.p24dd3180} fill="#A1A4AC" />
                 </svg>
                 {/* Instagram */}
                 <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                   <path d={svgPaths.pa42b330} fill="#A1A4AC" />
                   <path d={svgPaths.p28ca0900} fill="#A1A4AC" />
                   <path d={svgPaths.p117fb200} fill="#A1A4AC" />
                 </svg>
               </div>
             </div>
         </div>

         {/* Footer Disclaimer */}
         <div className="mt-5 flex items-center justify-center gap-1.5">
           <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
             <path d={svgPaths.p32f50700} fill="#68727D" transform="translate(1.333 1.333)" />
           </svg>
           <p className="text-sm text-[#68727d]" style={{ fontWeight: 500 }}>This is a preview of the email notifications.</p>
         </div>
     </div>
  </ModalWrapper>
);

const InAppPreviewModal = ({ onClose, data }: { onClose: () => void, data: AlertPreviewData }) => {
    const now = new Date();
    const mockUnread: AppNotification = {
        id: "preview-1",
        title: data.inAppTitle,
        contextLine: data.inAppText,
        module: "System",
        triggeredBy: { name: "System", initials: "", isSystem: true },
        timestamp: now,
        isRead: false,
        isActionRequired: false,
        isMandatory: false,
        isSystem: true,
        navigationTarget: "#",
    };
    const mockRead1: AppNotification = {
        id: "preview-2",
        title: "System Update",
        contextLine: "Omne has been updated to version 2.4.1.",
        module: "System",
        triggeredBy: { name: "System", initials: "", isSystem: true },
        timestamp: new Date(now.getTime() - 2 * 3600000),
        isRead: true,
        isActionRequired: false,
        isMandatory: false,
        isSystem: true,
        navigationTarget: "#",
    };
    const mockRead2: AppNotification = {
        id: "preview-3",
        title: "Weekly Report Ready",
        contextLine: "Your weekly activity report is ready to view.",
        module: "Reports",
        triggeredBy: { name: "System", initials: "", isSystem: true },
        timestamp: new Date(now.getTime() - 4 * 3600000),
        isRead: true,
        isActionRequired: false,
        isMandatory: false,
        isSystem: true,
        navigationTarget: "#",
    };

    return (
        <ModalWrapper title="Preview For In-App Notification" onClose={onClose} maxWidth="max-w-xl">
            <div className="w-full max-w-md mx-auto">
                <div className="flex flex-col gap-2 font-['Inter']">
                    <NotificationCard notification={mockUnread} isExpanded />
                    <NotificationCard notification={mockRead1} isExpanded />
                    <NotificationCard notification={mockRead2} isExpanded />
                </div>

                {/* Footer Disclaimer */}
                <div className="mt-6 flex items-center justify-center gap-2">
                    <Info size={15} className="text-[#9CA3AF] shrink-0" />
                    <p className="text-[14px] text-[#6B7280]" style={{ fontWeight: 500 }}>This is a preview of the in-app notifications in Omne.</p>
                </div>
            </div>
        </ModalWrapper>
    );
};

const PushPreviewModal = ({ onClose, data }: { onClose: () => void, data: AlertPreviewData }) => (
    <ModalWrapper title="Preview For Push Notification" onClose={onClose}>
        <div className="flex flex-col gap-5 items-center">
            {/* iPhone Device */}
            <div className="h-[614px] relative shrink-0 w-[300px]">
              {/* Shadow */}
              <div className="absolute bg-black inset-[0_1%] opacity-40 rounded-[50px]" style={{ boxShadow: '0px 0px 50px 0px rgba(0,0,0,0.8)' }} />

              {/* Wallpaper Screenshot (flipped vertically in Figma) */}
              <div className="absolute flex inset-[1.94%_4.44%_1.94%_4.67%] items-center justify-center">
                <div className="-scale-y-100 flex-none h-[590px] w-[273px]">
                  <div className="relative rounded-[15px] size-full">
                    <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[15px] size-full" src={imgScreenshot} />
                  </div>
                </div>
              </div>

              {/* Device Frame */}
              <div className="absolute inset-0">
                <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgIPhone14Pro2} />
              </div>

              {/* Dynamic Island */}
              <div className="absolute h-[24px] left-[110px] top-[20px] w-[80px]">
                <div className="absolute bg-black inset-0 rounded-[50px]" />
                <div className="absolute inset-[23.53%_6.96%_26.47%_78.26%]">
                  <div className="absolute inset-[0_-25.37%_-25%_-25.37%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.8261 15">
                      <g>
                        <g filter="url(#filter0_push)">
                          <path d={pushSvgPaths.p10c46600} fill="url(#paint0_push)" fillOpacity="0.3" />
                        </g>
                        <g filter="url(#filter1_push)">
                          <path d={pushSvgPaths.p12912640} fill="#2C2C2C" />
                        </g>
                        <g filter="url(#filter2_push)">
                          <ellipse cx="8.91304" cy="4.58823" fill="#616198" rx="1.04348" ry="0.352941" />
                        </g>
                        <g filter="url(#filter3_push)">
                          <ellipse cx="8.91304" cy="6.70588" fill="#1D6FAB" rx="0.347826" ry="0.352941" />
                        </g>
                      </g>
                      <defs>
                        <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="12" id="filter0_push" width="17.8261" x="0" y="3">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                          <feGaussianBlur result="effect1" stdDeviation="1.5" />
                        </filter>
                        <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="8.35294" id="filter1_push" width="8.26087" x="4.78261" y="1.82353">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                          <feGaussianBlur result="effect1" stdDeviation="0.5" />
                        </filter>
                        <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="2.70588" id="filter2_push" width="4.08696" x="6.86957" y="3.23529">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                          <feGaussianBlur result="effect1" stdDeviation="0.5" />
                        </filter>
                        <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="2.70588" id="filter3_push" width="2.69565" x="7.56522" y="5.35294">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                          <feGaussianBlur result="effect1" stdDeviation="0.5" />
                        </filter>
                        <linearGradient gradientUnits="userSpaceOnUse" id="paint0_push" x1="8.91304" x2="8.91304" y1="0" y2="12">
                          <stop offset="0.34375" stopColor="#6D4767" stopOpacity="0" />
                          <stop offset="1" stopColor="#6D4767" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Lock Icon + Time + Date */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col gap-3 items-center opacity-80 top-[102px] w-[129px]">
                <div className="relative shrink-0 size-[40px]">
                  <svg className="absolute block" fill="none" viewBox="0 0 26.6667 35" style={{ left: '16.67%', top: '6.25%', width: '66.66%', height: '87.5%' }}>
                    <path d={pushSvgPaths.p16bd8880} fill="white" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1 items-center w-full text-white leading-normal">
                  <p className="text-[52px] text-center w-full" style={{ fontWeight: 274, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                    9:41
                  </p>
                  <p className="text-[16px] text-center w-full" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                    Monday, June 21
                  </p>
                </div>
              </div>

              {/* Flashlight Button */}
              <div className="absolute flex items-center justify-center rounded-[86px]" style={{ background: 'rgba(17,17,17,0.4)', left: '8%', bottom: '3.91%', width: '38px', height: '38px' }}>
                <svg className="block" fill="none" viewBox="0 0 9.588 20.54" style={{ width: '9.59px', height: '20.54px' }}>
                  <path d={pushSvgPaths.p1c43bc80} fill="white" />
                </svg>
              </div>

              {/* Camera Button */}
              <div className="absolute flex items-center justify-center rounded-[86px]" style={{ background: 'rgba(17,17,17,0.4)', right: '8%', bottom: '3.91%', width: '38px', height: '38px' }}>
                <svg className="block" fill="none" viewBox="0 0 19.468 15.281" style={{ width: '19.47px', height: '15.28px' }}>
                  <path d={pushSvgPaths.p20c99f80} fill="white" />
                </svg>
              </div>

              {/* Notification Card */}
              <div className="absolute overflow-hidden rounded-[12px] flex gap-2 items-start p-2.5 left-[24px] top-[446px] w-[252px]" style={{ background: 'rgba(20,20,20,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                {/* App Icon */}
                <div className="relative shrink-0 size-[28px]">
                  <svg className="block size-full" fill="none" viewBox="0 0 28 28">
                    <rect fill="white" height="28" rx="6" width="28" />
                    <path d={pushSvgPaths.p20099300} fill="#0A77FF" />
                  </svg>
                </div>
                {/* Content */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex gap-1 items-start w-full">
                    <p className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-white text-[12px]" style={{ fontWeight: 590, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', lineHeight: 'normal' }}>
                      {data.inAppTitle || 'Alert Notification'}
                    </p>
                    {/* Time Badge */}
                    <div className="flex gap-0.5 h-3.5 items-center justify-center px-1 rounded-full shrink-0 opacity-70" style={{ background: 'rgba(255,255,255,0.16)' }}>
                      <svg className="shrink-0" fill="none" viewBox="0 0 5 5" style={{ width: '6px', height: '6px' }}>
                        <path d={pushSvgPaths.p173b4500} fill="white" />
                      </svg>
                      <p className="text-[8px] text-white shrink-0" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', lineHeight: 'normal' }}>
                        now
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white opacity-80 overflow-hidden text-ellipsis w-full" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', lineHeight: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {data.pushText}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Disclaimer */}
            <div className="flex gap-1.5 items-center justify-center">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                <path d={pushSvgPaths.p32f50700} fill="#68727D" transform="translate(1.333 1.333)" />
              </svg>
              <p className="text-sm text-[#68727d]" style={{ fontWeight: 500 }}>This is a preview of the push notification on a mobile device.</p>
            </div>
        </div>
    </ModalWrapper>
)
