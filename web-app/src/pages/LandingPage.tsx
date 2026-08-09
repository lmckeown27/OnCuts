/**
 * OnCuts Landing Page
 * 
 * Professional landing page with top navigation and comprehensive footer
 * Inspired by modern SaaS landing pages
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, X, ChevronDown } from 'lucide-react';
import Button from '../components/Button';
import PullToRefresh from '../components/PullToRefresh';
import BarberApplicationModal from '../components/BarberApplicationModal';
import UniversitySelector from '../components/UniversitySelector';
import IosAppPromoSection, { IOS_APP_STORE_LINKS } from '../components/IosAppPromoSection';
import type { CollegeTown } from '../types';
import { writeStoredCollegeTown } from '../utils/collegeTowns';
import { setBrowseConstrainByDistance, setBrowseDeviceTracking } from '../utils/consumerBrowseDistancePreference';
import { buildContactComposeUrl, openContactCompose } from '../utils/contactComposeUrl';
import webpageLogo from '../assets/logos/Webpage_Logo copy.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [showBarberApplication, setShowBarberApplication] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [faqCategory, setFaqCategory] = useState<'consumers' | 'barbers'>('consumers');
  
  const [selectedCollegeTown, setSelectedCollegeTown] = useState<CollegeTown | null>(null);

  const handleCollegeTownSelect = useCallback((town: CollegeTown | null) => {
    setSelectedCollegeTown(town);
    if (town) {
      writeStoredCollegeTown(town);
      setBrowseConstrainByDistance(true);
      setBrowseDeviceTracking(false);
    }
  }, []);

  const goToConsumerPage = useCallback(() => {
    if (selectedCollegeTown) {
      setBrowseConstrainByDistance(true);
      setBrowseDeviceTracking(false);
      navigate('/web/consumer', { state: { fromCollegeTownSelection: true } });
    }
  }, [selectedCollegeTown, navigate]);
  
  const toggleFaq = (id: string) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  const openContactPopup = () => {
    setShowContactPopup(true);
    // Trigger animation after mount
    setTimeout(() => setContactVisible(true), 10);
  };

  const closeContactPopup = () => {
    setContactVisible(false);
    setTimeout(() => {
      setShowContactPopup(false);
      setContactSubmitted(false);
      setContactForm({ name: '', email: '', message: '' });
    }, 200);
  };

  // Handle scroll for sticky navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pull-to-refresh handler for mobile - reload the page
  const handlePullToRefresh = async () => {
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handlePullToRefresh} className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img
                src={webpageLogo}
                alt="OnCuts"
                className="h-12 w-auto"
              />
              <span className={`hidden md:block text-2xl font-bold transition-colors duration-300 ${scrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                OnCuts
              </span>
            </button>

            <button
              onClick={() => navigate('/web')}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Offset fixed nav */}
      <div className="pt-20" />

      {/* Hero Section */}
      <div className="py-24 px-4 bg-gradient-to-br from-gray-50 via-white to-pink-50 flex flex-col items-center justify-center min-h-[55vh]">
          <div className="w-full max-w-2xl mb-8 text-center px-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
              On-Demand Haircuts
            </h1>
            <p className="mt-3 text-base sm:text-lg md:text-xl text-gray-600">
              Search below to browse and book barbers near you
            </p>
          </div>
          
          <div className="w-full max-w-2xl mb-10">
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-5">
              <UniversitySelector
                value={selectedCollegeTown}
                onChange={handleCollegeTownSelect}
                placeholder="Search near you..."
              />
            </div>
            {selectedCollegeTown && (
            <p className="mt-4 text-base sm:text-lg text-gray-600 text-center">
                Searching barbers near {selectedCollegeTown.shortName}
              </p>
            )}
          </div>
          
          {/* CTA Button */}
            <button
              onClick={goToConsumerPage}
              disabled={!selectedCollegeTown}
              className={`px-20 py-8 sm:py-9 font-bold text-3xl sm:text-4xl md:text-5xl rounded-3xl transition-all shadow-xl hover:shadow-2xl active:scale-95 ${
                selectedCollegeTown 
                  ? 'bg-brand-500 hover:bg-brand-600 text-white cursor-pointer' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Find Operator
            </button>
      </div>

      <IosAppPromoSection />

      {/* Operator CTA */}
      <div className="py-20 px-4 bg-gradient-to-br from-gray-900 to-gray-800 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Want to be an OnCuts Operator?
          </h2>
          <div className="flex justify-center">
            <button
              onClick={() => setShowBarberApplication(true)}
              className="px-12 py-5 sm:px-14 sm:py-6 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xl sm:text-2xl md:text-3xl transition-colors shadow-lg hover:shadow-xl active:scale-95"
            >
              Become an Operator
            </button>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 px-4 bg-white shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]" id="faq">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          {/* Mobile Toggle Slider */}
          <div className="md:hidden flex justify-center mb-8">
            <div className="inline-flex bg-gray-100 rounded-full p-1">
              <button
                onClick={() => {
                  setFaqCategory('consumers');
                  setOpenFaq(null);
                }}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  faqCategory === 'consumers'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Clients
              </button>
              <button
                onClick={() => {
                  setFaqCategory('barbers');
                  setOpenFaq(null);
                }}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  faqCategory === 'barbers'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Operators
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Consumers Column - Hidden on mobile when barbers selected */}
            <div className={`${faqCategory === 'barbers' ? 'hidden md:block' : ''}`}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center hidden md:block">
                For Clients
              </h3>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c1')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I book a service?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c1' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c1' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>
                          Download{' '}
                          <a href={IOS_APP_STORE_LINKS.consumer} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:underline">
                            OnCuts
                          </a>{' '}
                          on iPhone, or search near you here and tap &quot;Find Operator&quot; on the web.
                        </li>
                        <li>Browse operators near you and view their portfolio.</li>
                        <li>Pick a service, date, and time, add where you&apos;ll meet, then submit your request.</li>
                        <li>Wait for a notification when the operator accepts. Then you can pay and message them.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c2')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">When and how do I pay?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c2' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c2' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">
                        Pay the service after the operator accepts, in the app or on the web with card, Apple Pay, or Google Pay. After they mark the service complete, you can add an optional tip ($4, $5, $6, or a custom amount).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c3')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Where do services happen?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c3' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c3' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">
                        Operators set a service area so clients can find them nearby. When you book, enter where you&apos;ll meet: campus spots, dorms, homes, or other nearby places you coordinate together.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c4')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Can I edit or cancel my booking?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c4' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c4' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">
                        Yes. You can update time, date, meeting details, or notes before the service is marked complete. The operator is notified of changes. Cancel anytime before completion. If you cancel a paid booking within 1 hour of the appointment, the service payment is non-refundable; if the operator cancels, you get a full refund.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c5')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I contact my operator?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c5' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c5' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>After they accept your request, open messaging in the OnCuts app or on the web.</li>
                        <li>Chat to coordinate details or share reference photos.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c6')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Is my payment secure?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c6' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c6' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">
                        Yes. Stripe processes all card payments. We never store your card details. Stripe handles everything with bank-level encryption.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* For Operators Column - Hidden on mobile when consumers selected */}
            <div className={`${faqCategory === 'consumers' ? 'hidden md:block' : ''}`}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center hidden md:block">
                For Operators
              </h3>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b1')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I join as an operator?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b1' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b1' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Tap &quot;Become an Operator&quot; on this site and submit your application.</li>
                        <li>
                          Once approved, download{' '}
                          <a href={IOS_APP_STORE_LINKS.interaProvider} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:underline">
                            OnCuts Operator
                          </a>{' '}
                          from the App Store, or use the operator web dashboard.
                        </li>
                        <li>Set up your services, prices, availability, and portfolio.</li>
                        <li>Finish Stripe Connect in Payouts so clients can book and pay you.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b2')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How much do I keep?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b2' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b2' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>OnCuts takes a platform fee on card service payments (default 15%; set by OnCuts).</li>
                        <li>You keep 100% of tips. Tips never include a platform fee.</li>
                        <li>New operators typically get several commission-free card bookings (default 5), or a time-limited commission-free window when OnCuts grants one. During those bookings, a platform-funded kickback may also apply when configured.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b3')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How does payment work?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b3' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b3' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Accept the booking. The client then pays the service through OnCuts with card or digital wallet.</li>
                        <li>After the service, mark the booking complete in OnCuts Operator or your web dashboard so the client can tip.</li>
                        <li>Card take-home goes to your Stripe Express balance, then to your bank.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b4')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">When do payouts reach my bank?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b4' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b4' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>New Stripe accounts usually wait about 7 to 14 business days after the first live card payment before the first bank payout.</li>
                        <li>After that, eligible Instant payouts can arrive in minutes; otherwise Stripe follows your Express schedule (often about 2 business days).</li>
                        <li>Open Payouts on your operator dashboard for Stripe Express, the Stripe App, and payout Q&amp;A.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b5')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I manage my schedule?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b5' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b5' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Set weekly hours under Edit Schedule in OnCuts Operator or your web dashboard.</li>
                        <li>Use Block Time for one-off unavailable dates or hours.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b6')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Can I decline booking requests?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b6' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b6' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">
                        Yes. Accept or decline every booking request. You choose which jobs to take.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team join */}
          <div className="mt-12 border-t border-gray-100 pt-10 text-center">
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">Wanna join the Corporate Team?</h3>
            <button
              onClick={openContactPopup}
              className="mt-8 inline-flex items-center justify-center px-12 py-5 sm:px-14 sm:py-6 bg-brand-500 font-semibold text-xl sm:text-2xl md:text-3xl text-white rounded-2xl shadow-md transition-colors hover:bg-brand-600"
            >
              Hit us up
            </button>
          </div>
        </div>
      </div>

      {/* Barber Application Modal (Guest Mode) */}
      <BarberApplicationModal
        isOpen={showBarberApplication}
        onClose={() => setShowBarberApplication(false)}
        guestMode={true}
      />

      {/* Contact popup */}
      {showContactPopup && (
        <div 
          className={`fixed inset-0 min-h-[100dvh] bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${contactVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeContactPopup}
        >
          <div 
            className={`bg-white rounded-3xl p-8 max-w-lg w-full max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto transition-all duration-200 ${contactVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">Wanna join the Corporate Team?</h2>
              <button
                onClick={closeContactPopup}
                className="absolute top-0 right-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {contactSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600 mb-6">We'll get back to you as soon as possible.</p>
                <button
                  onClick={closeContactPopup}
                  className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const composeUrl = buildContactComposeUrl({
                    senderEmail: contactForm.email,
                    senderName: contactForm.name,
                    message: contactForm.message,
                  });
                  openContactCompose(composeUrl);
                  setContactSubmitted(true);
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 outline-none transition-colors"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Email
                  </label>
                  <input
                    type="email"
                    id="contact-email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 outline-none transition-colors"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 outline-none transition-colors resize-none"
                    placeholder="Tell us how you'd like to join or help out"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Minimal footer — horizontal on desktop, stacked on mobile */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="mx-auto max-w-7xl px-8 py-10 max-sm:py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 max-sm:gap-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="flex flex-col items-center gap-2 max-sm:text-center sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="shrink-0 transition-opacity hover:opacity-80"
                aria-label="Back to top"
              >
                <img src={webpageLogo} alt="OnCuts" className="h-10 w-auto" />
              </button>
              <p className="text-sm text-gray-500 sm:whitespace-nowrap">
                © 2026 OnCuts. All rights reserved.
              </p>
            </div>

            <ul className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-4 text-base sm:flex-1 sm:gap-x-8 sm:text-lg max-sm:flex-col max-sm:gap-y-5">
              <li className="flex justify-center">
                <a
                  href="https://oncuts.com/privacy"
                  className="inline-flex items-center justify-center px-4 py-2.5 transition-colors duration-200 hover:text-white sm:px-5 sm:py-3"
                >
                  Privacy Policy
                </a>
              </li>
              <li className="flex justify-center">
                <a
                  href="https://oncuts.com/terms"
                  className="inline-flex items-center justify-center px-4 py-2.5 transition-colors duration-200 hover:text-white sm:px-5 sm:py-3"
                >
                  Terms of Service
                </a>
              </li>
              <li className="flex justify-center">
                <a
                  href="https://oncuts.com/gdpr"
                  className="inline-flex items-center justify-center px-4 py-2.5 transition-colors duration-200 hover:text-white sm:px-5 sm:py-3"
                >
                  GDPR
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </PullToRefresh>
  );
}
