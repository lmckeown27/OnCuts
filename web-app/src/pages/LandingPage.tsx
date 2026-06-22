/**
 * CampusCuts Landing Page
 * 
 * Professional landing page with top navigation and comprehensive footer
 * Inspired by modern SaaS landing pages
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, X, Mail, ChevronDown } from 'lucide-react';
import Button from '../components/Button';
import PullToRefresh from '../components/PullToRefresh';
import BarberApplicationModal from '../components/BarberApplicationModal';
import UniversitySelector from '../components/UniversitySelector';
import Marquee from '../components/Marquee';
import IosAppPromoSection, { IOS_APP_STORE_LINKS } from '../components/IosAppPromoSection';
import type { University } from '../components/UniversitySelector';
import webpageLogo from '../assets/logos/Webpage_Logo copy.png';

const UNIVERSITY_STORAGE_KEY = 'campuscut_selected_university';

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
  
  // University selector state for hero section
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  
  // Handle university selection - save to localStorage and navigate to consumer page
  const handleUniversitySelect = useCallback((university: University | null) => {
    setSelectedUniversity(university);
    if (university) {
      localStorage.setItem(UNIVERSITY_STORAGE_KEY, JSON.stringify(university));
    }
  }, []);
  
  // Navigate to consumer page when university is selected
  const goToConsumerPage = useCallback(() => {
    if (selectedUniversity) {
      navigate('/web/consumer');
    }
  }, [selectedUniversity, navigate]);
  
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
                alt="CampusCuts"
                className="h-12 w-auto"
              />
              <span className={`hidden md:block text-2xl font-bold transition-colors duration-300 ${scrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                CampusCuts
              </span>
            </button>

            <button
              onClick={() => navigate('/web')}
              className="px-5 py-2 bg-primary-400 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Book Here
            </button>
          </div>
        </div>
      </nav>

      {/* Stats Banner */}
      <div className="pt-20 bg-gradient-to-br from-primary-50 via-white to-pink-50">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-row items-center justify-center gap-4 sm:gap-12 md:gap-20">
            {/* Stat 1 - Total Cuts */}
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
                <span className="text-2xl sm:text-5xl font-bold text-primary-600">1,000</span>
                <span className="text-lg sm:text-3xl font-bold text-primary-500">+</span>
              </div>
              <p className="text-gray-600 text-xs sm:text-base mt-0.5 sm:mt-1">completed cuts nationwide</p>
            </div>
            
            {/* Divider */}
            <div className="w-px h-10 sm:h-16 bg-gray-300" />
            
            {/* Stat 2 - Reviews */}
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
                <span className="text-2xl sm:text-5xl font-bold text-primary-600">100</span>
                <span className="text-lg sm:text-3xl font-bold text-primary-500">+</span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5 sm:mt-1">
                <span className="text-xs sm:text-base font-semibold text-gray-700">5</span>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-gray-600 text-xs sm:text-base">reviews per campus</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Marquee />

      <IosAppPromoSection />

      {/* Hero Section */}
      <div className="py-20 px-4 bg-gradient-to-br from-primary-50 via-white to-pink-50 flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-xl mb-6 text-center px-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
              Don&apos;t have an iOS Device?
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Search below to browse and book campus barbers on the web
            </p>
          </div>
          
          {/* University Selector */}
        <div className="w-full max-w-xl mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-3 sm:p-4">
              <UniversitySelector
                value={selectedUniversity}
                onChange={handleUniversitySelect}
                placeholder="Search for your university..."
              />
            </div>
            {selectedUniversity && (
            <p className="mt-4 text-sm text-gray-600 text-center">
                Searching barbers at {selectedUniversity.shortName || selectedUniversity.name}
              </p>
            )}
          </div>
          
          {/* CTA Button */}
            <button
              onClick={goToConsumerPage}
              disabled={!selectedUniversity}
              className={`px-16 py-7 sm:py-8 font-bold text-2xl sm:text-3xl md:text-4xl rounded-3xl transition-all shadow-xl hover:shadow-2xl active:scale-95 ${
                selectedUniversity 
                  ? 'bg-primary-400 hover:bg-primary-500 text-white cursor-pointer' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Find Barber
            </button>
      </div>

      {/* Barber CTA */}
      <div className="py-20 px-4 bg-gradient-to-br from-primary-400 to-primary-500 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Want to be a CampusCuts Barber?
          </h2>
          <div className="flex justify-center">
            <button 
              onClick={() => setShowBarberApplication(true)}
              className="px-6 py-4 rounded-lg bg-white border-2 border-primary-500 hover:bg-primary-50 transition-colors shadow-lg hover:shadow-xl active:scale-95"
            >
              <span className="text-lg font-semibold text-primary-600">Become a Barber</span>
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
                For Customers
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
                For Barbers
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Consumers Column - Hidden on mobile when barbers selected */}
            <div className={`${faqCategory === 'barbers' ? 'hidden md:block' : ''}`}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center hidden md:block">
                For Customers
              </h3>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c1')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I book a haircut?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c1' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c1' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>
                          Download{' '}
                          <a href={IOS_APP_STORE_LINKS.consumer} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
                            CampusCuts
                          </a>{' '}
                          on iPhone, or select your university here and tap &quot;Find Barber&quot; on the web.
                        </li>
                        <li>Browse barbers at your school and view their portfolio.</li>
                        <li>Pick a service, date, time, and location, then submit your request.</li>
                        <li>Wait for a notification when the barber accepts.</li>
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Pay after your haircut is complete. When the barber marks it done, pay in the app or on the web with card, Apple Pay, or Google Pay. Tips are optional (15%, 20%, or 25%).</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c3')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Where do haircuts happen?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c3' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c3' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Choose from your barber&apos;s listed locations when you book. Options may include on-campus spots, dorms, or nearby areas.</p>
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Yes. Edit time, date, location, or notes while your booking is pending. After acceptance, send a reschedule request for schedule changes. Cancel anytime before the service is marked complete.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c5')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I contact my barber?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c5' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c5' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Open messaging in the CampusCuts app or on the web.</li>
                        <li>Chat with your barber to coordinate details or share reference photos.</li>
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Yes. Stripe processes all payments. We never store your card details. Stripe handles everything with bank-level encryption.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* For Barbers Column - Hidden on mobile when consumers selected */}
            <div className={`${faqCategory === 'consumers' ? 'hidden md:block' : ''}`}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center hidden md:block">
                For Barbers
              </h3>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b1')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I join as a barber?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b1' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b1' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Tap &quot;Become a Barber&quot; on this site and submit your application.</li>
                        <li>
                          Once approved, download{' '}
                          <a href={IOS_APP_STORE_LINKS.interaProvider} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
                            InteraProvider
                          </a>{' '}
                          from the App Store.
                        </li>
                        <li>Set up your services, prices, availability, and portfolio.</li>
                        <li>Connect Stripe to start accepting bookings.</li>
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
                        <li>You keep 85% of every payment.</li>
                        <li>You keep 100% of tips.</li>
                        <li>CampusCuts takes a 15% platform fee, far less than the 50% many shops take.</li>
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
                        <li>Mark the booking complete in InteraProvider or your barber dashboard after the haircut.</li>
                        <li>The customer pays through CampusCuts.</li>
                        <li>Funds deposit directly to your connected Stripe account.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b4')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I manage my schedule?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b4' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b4' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <ol className="px-4 pb-4 text-gray-600 text-sm text-left list-decimal list-inside space-y-1.5 max-w-md mx-auto">
                        <li>Set your weekly hours in InteraProvider or your barber dashboard.</li>
                        <li>Block specific dates or times when needed.</li>
                        <li>Optionally connect Google Calendar to auto-block busy times.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b6')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Why connect Google Calendar?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b6' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b6' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Google Calendar sync blocks busy times so customers cannot double-book you. We only see when you are busy, not event details. Disconnect anytime in InteraProvider or your dashboard.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b5')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Can I decline booking requests?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b5' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b5' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Yes. Accept or decline every booking request. You choose which jobs to take.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Partnerships & inquiries */}
          <div className="mt-12 border-t border-gray-100 pt-10 text-center">
            <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">Let&apos;s Connect</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
              Whether you&apos;re a prospective barber, a campus partner, or interested in the CampusCuts System, we&apos;d love to hear from you
            </p>
            <button
              onClick={openContactPopup}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-primary-400 font-medium text-white rounded-lg shadow-sm transition-colors hover:bg-primary-500"
            >
              <Mail className="h-5 w-5" />
              Connect with the Team
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
              <h2 className="text-2xl font-bold text-gray-900 text-center">Connect with the Team</h2>
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
                  className="px-6 py-2 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Open mailto with pre-filled content
                  const subject = encodeURIComponent(`CampusCuts Support Request from ${contactForm.name}`);
                  const body = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`);
                  window.location.href = `mailto:campuscuthelp@gmail.com?subject=${subject}&body=${body}`;
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-colors"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-colors"
                    placeholder="john@university.edu"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-colors resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Send Message
                </button>

                <p className="text-xs text-gray-500 text-center">
                  This will open your email client with the message pre-filled
                </p>
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
                <img src={webpageLogo} alt="CampusCuts" className="h-10 w-auto" />
              </button>
              <p className="text-sm text-gray-500 sm:whitespace-nowrap">
                © 2026 CampusCuts. All rights reserved.
              </p>
            </div>

            <ul className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-4 text-base sm:flex-1 sm:gap-x-8 sm:text-lg max-sm:flex-col max-sm:gap-y-5">
              <li className="flex justify-center">
                <a
                  href="https://campuscut.com/privacy"
                  className="inline-flex items-center justify-center px-4 py-2.5 transition-colors duration-200 hover:text-white sm:px-5 sm:py-3"
                >
                  Privacy Policy
                </a>
              </li>
              <li className="flex justify-center">
                <a
                  href="https://campuscut.com/terms"
                  className="inline-flex items-center justify-center px-4 py-2.5 transition-colors duration-200 hover:text-white sm:px-5 sm:py-3"
                >
                  Terms of Service
                </a>
              </li>
              <li className="flex justify-center">
                <a
                  href="https://campuscut.com/gdpr"
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
