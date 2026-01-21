/**
 * Biometric Prompt Modal
 * 
 * Shows after successful login to prompt users to enable Touch ID / Face ID
 * for faster login next time.
 */

import { useState } from 'react';
import { X, Fingerprint, ScanFace, Shield, Smartphone, CheckCircle } from 'lucide-react';
import webauthnService from '../services/webauthn.service';
import toast from 'react-hot-toast';

interface BiometricPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
  userEmail: string;
}

export default function BiometricPromptModal({ 
  isOpen, 
  onClose, 
  onSkip,
  userEmail 
}: BiometricPromptModalProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  
  const biometricType = webauthnService.getBiometricType();
  const biometricIcon = webauthnService.getBiometricIcon();

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await webauthnService.registerBiometric(biometricType);
      webauthnService.saveLastEmail(userEmail);
      webauthnService.markBiometricPrompted(userEmail);
      setIsEnabled(true);
      toast.success(`${biometricType} enabled!`);
      
      // Close after a brief moment to show success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to enable biometric:', error);
      const message = error.message || 'Failed to enable biometric login';
      // Don't show error for user cancellation
      if (!message.includes('cancelled') && !message.includes('canceled')) {
        toast.error(message);
      }
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    webauthnService.markBiometricPrompted(userEmail);
    onSkip();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleSkip}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-5 text-center relative">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
            {isEnabled ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : biometricIcon === 'face' ? (
              <ScanFace className="w-10 h-10 text-white" />
            ) : biometricIcon === 'shield' ? (
              <Shield className="w-10 h-10 text-white" />
            ) : (
              <Fingerprint className="w-10 h-10 text-white" />
            )}
          </div>
          
          <h2 className="text-xl font-bold text-white">
            {isEnabled ? 'All Set!' : `Enable ${biometricType}?`}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          {isEnabled ? (
            <div className="text-center">
              <p className="text-gray-600">
                Next time you visit, just use {biometricType} to sign in instantly!
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-center mb-6">
                Sign in faster next time without typing your password. 
                Your biometric data never leaves your device.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4 text-primary-600" />
                  </div>
                  <span>Secure authentication stored on your device</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {biometricIcon === 'face' ? (
                      <ScanFace className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Fingerprint className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                  <span>Sign in with just a glance or touch</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleEnable}
                  disabled={isEnabling}
                  className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isEnabling ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      {biometricIcon === 'face' ? (
                        <ScanFace className="w-5 h-5" />
                      ) : (
                        <Fingerprint className="w-5 h-5" />
                      )}
                      <span>Enable {biometricType}</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleSkip}
                  className="w-full py-3 px-4 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

