/**
 * CampusCut Landing Page
 * 
 * Professional landing page with top navigation and comprehensive footer
 * Inspired by modern SaaS landing pages
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Menu, X, ExternalLink, Youtube, Instagram, Mail, ChevronDown } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import PullToRefresh from '../components/PullToRefresh';
import { CampusCutLogo } from '@assets';
import HeaderChairLogo from '../assets/logos/Header_Chair.webp';
import MainChairLogo from '../assets/logos/Main_Chair.webp';
import MobileHeaderChairLogo from '../assets/logos/Mobile_Header_Chair.webp';
import FooterChairLogo from '../assets/logos/Footer_Chair.webp';
import { useViewport } from '../hooks/useViewport';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  
  // Viewport detection for responsive layout
  const { isMobile, isMobilePortrait, viewport } = useViewport();
  
  // Handle "Find Barber" click - navigate to questionnaire
  const handleFindBarberClick = useCallback(() => {
    navigate('/web/find-barber');
  }, [navigate]);
  
  // Mobile menu open/close with animation
  const openMobileMenu = () => {
    setMobileMenuOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMobileMenuVisible(true);
      });
    });
  };
  
  const closeMobileMenu = () => {
    setMobileMenuVisible(false);
    setTimeout(() => {
      setMobileMenuOpen(false);
    }, 200);
  };
  
  const toggleMobileMenu = () => {
    if (mobileMenuOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  };
  
  // Close mobile menu when viewport changes to desktop
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      closeMobileMenu();
    }
  }, [isMobile, mobileMenuOpen]);

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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  // Pull-to-refresh handler for mobile
  const handlePullToRefresh = async () => {
    // For landing page, just scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <PullToRefresh onRefresh={handlePullToRefresh} className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative">
            {/* Mobile Menu Button - Left on mobile */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors relative w-10 h-10 flex items-center justify-center"
            >
              <Menu 
                className={`w-6 h-6 absolute transition-all duration-200 ease-out ${
                  mobileMenuVisible 
                    ? 'opacity-0 rotate-90 scale-50' 
                    : 'opacity-100 rotate-0 scale-100'
                }`} 
              />
              <X 
                className={`w-6 h-6 absolute transition-all duration-200 ease-out ${
                  mobileMenuVisible 
                    ? 'opacity-100 rotate-0 scale-100' 
                    : 'opacity-0 -rotate-90 scale-50'
                }`} 
              />
            </button>
            
            {/* Logo - centered on mobile, left on desktop */}
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity md:relative absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0"
            >
              {/* Desktop logo with scroll effect */}
              <div className="relative hidden md:block">
                <img 
                  src={HeaderChairLogo} 
                  alt="CampusCut" 
                  className={`h-12 w-auto transition-opacity duration-300 ${scrolled ? 'opacity-0' : 'opacity-100'}`} 
                />
                <img 
                  src={MainChairLogo} 
                  alt="CampusCut" 
                  className={`h-12 w-auto absolute top-0 left-0 transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`} 
                />
              </div>
              {/* Mobile logo with instant swap on scroll */}
              <div className="relative md:hidden">
                <img 
                  src={MobileHeaderChairLogo} 
                  alt="CampusCut" 
                  className={`h-12 w-auto ${scrolled ? 'opacity-0' : 'opacity-100'}`} 
                />
                <img 
                  src={MainChairLogo} 
                  alt="CampusCut" 
                  className={`h-12 w-auto absolute top-0 left-0 ${scrolled ? 'opacity-100' : 'opacity-0'}`} 
                />
              </div>
              <span className={`hidden md:block text-2xl font-bold transition-colors duration-300 ${scrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                CampusCut
              </span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('how-it-works')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                How It Works
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                Pricing Explained
              </button>
              <button onClick={() => scrollToSection('faq')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                FAQ
              </button>
            </div>

            {/* CTA Buttons - Desktop */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/web')}
                className="px-5 py-2 bg-primary-400 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Become a Barber
              </button>
            </div>

            {/* Right spacer for mobile to balance the menu button */}
            <div className="w-10 md:hidden" />
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div 
            className={`md:hidden bg-white border-t border-gray-200 shadow-lg overflow-hidden transition-all duration-200 ease-out ${
              mobileMenuVisible 
                ? 'max-h-96 opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className={`px-4 py-4 space-y-3 transition-all duration-200 ${
              mobileMenuVisible ? 'translate-y-0' : '-translate-y-2'
            }`}>
              <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                How It Works
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                Pricing Explained
              </button>
              <button onClick={() => scrollToSection('faq')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                FAQ
              </button>
              <div className="pt-3 border-t border-gray-200">
                <button 
                  onClick={() => {
                    closeMobileMenu();
                    navigate('/web');
                  }} 
                  className="w-full px-4 py-3 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Become a Barber
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 bg-gradient-to-br from-primary-50 via-white to-pink-50">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Earn More, Pay Less
          </h1>
          
          {/* CTA Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handleFindBarberClick}
              className="px-8 py-4 sm:py-5 bg-primary-400 hover:bg-primary-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              Find Barber
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Section - Video Showcase */}
      <div className="py-20 px-4 bg-white" id="how-it-works">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              See Our Work
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Check out some of the amazing cuts from our talented campus barbers
            </p>
          </div>
          
          {/* Video Grid - 3 YouTube Shorts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Video 1 */}
            <div className="relative w-full rounded-2xl shadow-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '9/16' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/I9MlYYn4wUM"
                title="CampusCut Showcase 1"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            {/* Video 2 */}
            <div className="relative w-full rounded-2xl shadow-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '9/16' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/aPAqtReSjX0"
                title="CampusCut Showcase 2"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            {/* Video 3 */}
            <div className="relative w-full rounded-2xl shadow-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '9/16' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/yi4qTTBbhx8"
                title="CampusCut Showcase 3"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>

        </div>
      </div>

      {/* Economic Comparison Section */}
      <div className="py-20 px-4 bg-gradient-to-br from-gray-50 to-primary-50" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              The Math Behind "Earn More, Pay Less"
            </h2>
          </div>

          {/* The Numbers */}
          <div className="max-w-6xl mx-auto mb-12">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Traditional Barbershop */}
              <Card className="border-2 border-red-200 bg-red-50">
                <div className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Traditional Barbershop</h3>
                    <p className="text-gray-600">How it usually works</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700 font-medium">Customer Pays:</span>
                        <span className="text-2xl font-bold text-gray-900">$35</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: '100%' }}></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700 font-medium">Shop Takes (50%):</span>
                        <span className="text-xl font-bold text-red-600">-$17.50</span>
                      </div>
                      <p className="text-xs text-gray-500">Rent, utilities, reception, overhead</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border-2 border-red-300">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-bold">Barber Earns:</span>
                        <span className="text-3xl font-bold text-red-700">$17.50</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Only 50% of what customer paid</p>
                    </div>
                  </div>

                </div>
              </Card>

              {/* CampusCut Model */}
              <Card className="border-2 border-green-300 bg-green-50">
                <div className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">CampusCut</h3>
                    <p className="text-gray-600">How we're different</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700 font-medium">Customer Pays:</span>
                        <span className="text-2xl font-bold text-gray-900">$28</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700 font-medium">Platform Fee (5%):</span>
                        <span className="text-xl font-bold text-orange-600">-$1.40</span>
                      </div>
                      <p className="text-xs text-gray-500">No overhead, just technology</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border-2 border-green-400">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-bold">Barber Earns:</span>
                        <span className="text-3xl font-bold text-green-700">$26.60</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">95% of what customer paid</p>
                    </div>
                  </div>

                </div>
              </Card>
            </div>
          </div>

        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 px-4 bg-white" id="faq">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Consumers Column */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                For Consumers
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Browse barber profiles, pick one you like, and send a booking request with your preferred date, time, and location. The barber will accept or suggest an alternative.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c2')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I pay?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c2' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c2' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Pay securely through the app—no cash needed. Payment is only released to the barber after they mark your booking as complete.</p>
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">You and the barber agree on a location—usually on campus in dorms, apartments, or common areas. It's all coordinated through the booking.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('c4')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">What if I need to cancel?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'c4' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'c4' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">You can cancel anytime before the barber confirms completion. Just be respectful of their time—frequent no-shows affect your reliability score.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* For Barbers Column */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                For Barbers
              </h3>
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b1')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">How do I start cutting on CampusCut?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b1' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b1' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Create your profile, add your services and prices, link your Instagram portfolio, and start accepting booking requests. You're in control.</p>
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
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">You keep 95% of every payment. We only take a 5% platform fee—way less than the 40-60% traditional shops take.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b3')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">When do I get paid?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b3' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b3' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Instantly. As soon as you mark a booking as complete, the payment is released to you. No waiting periods.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq('b4')}
                    className="w-full flex items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-2"
                  >
                    <h4 className="font-medium text-gray-900">Can I decline requests?</h4>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openFaq === 'b4' ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${openFaq === 'b4' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-gray-600 text-sm text-center">Absolutely. You choose which requests to accept based on timing, location, and customer reliability scores. Your schedule, your rules.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA below FAQ */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Still have questions?</p>
            <button 
              onClick={openContactPopup}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
            >
              <Mail className="w-5 h-5" />
              Contact Support
            </button>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 px-4 bg-gradient-to-br from-primary-400 to-primary-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Book?
          </h2>
          <div className="flex justify-center">
            <button 
              onClick={handleFindBarberClick}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-primary-600 font-bold rounded-lg transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              Find Barber
            </button>
          </div>
        </div>
      </div>

      {/* Contact Support Popup */}
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
              <h2 className="text-2xl font-bold text-gray-900 text-center">Contact Support</h2>
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
                  const subject = encodeURIComponent(`CampusCut Support Request from ${contactForm.name}`);
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

      {/* Comprehensive Footer - Inspired by Cluely */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Resources */}
            <div>
              <h4 className="font-bold text-white mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => scrollToSection('how-it-works')} className="text-gray-400 hover:text-white transition-colors">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/web')} className="text-gray-400 hover:text-white transition-colors">
                    Campus Manager
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/help')} className="text-gray-400 hover:text-white transition-colors">
                    Help Center
                  </button>
                </li>
              </ul>
            </div>

            {/* For You */}
            <div>
              <h4 className="font-bold text-white mb-4">For You</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => scrollToSection('pricing')} className="text-gray-400 hover:text-white transition-colors">
                    Pricing Explained
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('faq')} className="text-gray-400 hover:text-white transition-colors">
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/help')} className="text-gray-400 hover:text-white transition-colors">
                    Help Center
                  </button>
                </li>
                <li>
                  <button onClick={openContactPopup} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                    Contact Us <Mail className="w-3 h-3" />
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('faq')} className="text-gray-400 hover:text-white transition-colors">
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => navigate('/privacy')} className="text-gray-400 hover:text-white transition-colors">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/terms')} className="text-gray-400 hover:text-white transition-colors">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/gdpr')} className="text-gray-400 hover:text-white transition-colors">
                    GDPR
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Logo and Copyright */}
              <div className="flex items-center gap-3">
                <img src={FooterChairLogo} alt="CampusCut" className="h-8 w-auto" />
                <div>
                  <p className="text-gray-400 text-sm">
                    © 2025 CampusCut. All rights reserved.
                  </p>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4">
                <a href="https://www.instagram.com/campuscutsslo/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <a 
                  href="https://youtube.com/@campuscuts" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-center text-gray-500 text-sm mt-6">
              Connecting talented barbers with students since 2025 • Fair Pricing • Secure Payments • Campus Community
            </p>
          </div>
        </div>
      </footer>
    </PullToRefresh>
  );
}
