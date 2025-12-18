/**
 * App Installation Instructions Page
 * 
 * Guides users through installing CampusCuts as a PWA on their device
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Smartphone, 
  Monitor, 
  Download, 
  Share2, 
  Plus, 
  Chrome, 
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { 
  isAppInstalled, 
  isIOSDevice, 
  isAndroidDevice, 
  getPlatform,
  BeforeInstallPromptEvent 
} from '../utils/appUtils';
import { CampusCutsLogo } from '@assets';

export default function AppInstallPage() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    setIsInstalled(isAppInstalled());
    setPlatform(getPlatform());

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    const installHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <img src={CampusCutsLogo} alt="CampusCuts" className="h-20 w-auto mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Install CampusCuts
          </h1>
          <p className="text-xl text-gray-600">
            Get the full app experience with offline access and push notifications
          </p>
        </div>

        {/* Installation Status */}
        {isInstalled ? (
          <Card className="mb-8 bg-green-50 border-2 border-green-300">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-full p-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-900 mb-1">
                  App Installed!
                </h3>
                <p className="text-green-700">
                  CampusCuts is installed on your device. You can now use it offline and receive push notifications.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* Quick Install (Android/Desktop Chrome) */}
            {deferredPrompt && (platform === 'android' || platform === 'desktop') && (
              <Card className="mb-8 bg-primary-50 border-2 border-primary-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-primary-100 rounded-full p-3">
                    <Download className="w-8 h-8 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      Quick Install Available
                    </h3>
                    <p className="text-gray-600">
                      Click the button below to install CampusCuts instantly
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleInstallClick}
                  className="w-full bg-primary-400 hover:bg-primary-500"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Install CampusCuts
                </Button>
              </Card>
            )}

            {/* iOS Installation Instructions */}
            {platform === 'ios' && (
              <Card className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Install on iOS (iPhone/iPad)
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <p className="text-gray-700">
                        Tap the <strong>Share</strong> button <Share2 className="w-4 h-4 inline text-blue-600" /> at the bottom of Safari
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <p className="text-gray-700">
                        Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="w-4 h-4 inline text-blue-600" />
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <p className="text-gray-700">
                        Tap <strong>"Add"</strong> in the top-right corner
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <p className="text-gray-700">
                        Open CampusCuts from your home screen!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> You must use Safari browser to install CampusCuts on iOS devices.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Android Installation Instructions */}
            {platform === 'android' && !deferredPrompt && (
              <Card className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-green-100 rounded-full p-3">
                    <Smartphone className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Install on Android
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <p className="text-gray-700">
                        Tap the <strong>menu button</strong> (⋮) in the top-right corner of Chrome
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <p className="text-gray-700">
                        Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <p className="text-gray-700">
                        Tap <strong>"Install"</strong> or <strong>"Add"</strong> to confirm
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <p className="text-gray-700">
                        Open CampusCuts from your home screen or app drawer!
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Desktop Installation Instructions */}
            {platform === 'desktop' && !deferredPrompt && (
              <Card className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-indigo-100 rounded-full p-3">
                    <Monitor className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Install on Desktop
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <p className="text-gray-700">
                        Look for the <strong>install icon</strong> <Download className="w-4 h-4 inline text-indigo-600" /> in your browser's address bar
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <p className="text-gray-700">
                        Click the install icon and then click <strong>"Install"</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <p className="text-gray-700">
                        CampusCuts will open in its own window, like a native app!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex gap-2">
                    <Chrome className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-800">
                      <strong>Best Experience:</strong> Use Chrome, Edge, or another Chromium-based browser for the best installation experience.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Benefits of Installing */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Why Install the App?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Works Offline</h3>
              <p className="text-gray-600 text-sm">
                Access your bookings and barber profiles even without internet
              </p>
            </Card>

            <Card className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Push Notifications</h3>
              <p className="text-gray-600 text-sm">
                Get instant alerts for booking confirmations and messages
              </p>
            </Card>

            <Card className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Native Experience</h3>
              <p className="text-gray-600 text-sm">
                Feels like a real app with fast loading and smooth animations
              </p>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={() => navigate(isInstalled ? '/app' : '/')}
            className="bg-primary-400 hover:bg-primary-500"
          >
            {isInstalled ? 'Open CampusCuts' : 'Continue to Website'}
          </Button>
        </div>
      </div>
    </div>
  );
}

