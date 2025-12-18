/**
 * CampusCuts Landing Page
 * 
 * Professional landing page with top navigation and comprehensive footer
 * Inspired by modern SaaS landing pages
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, DollarSign, Zap, Users, Star, CheckCircle, TrendingUp, Menu, X, ExternalLink, Github, Twitter, Instagram, Mail } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { CampusCutsLogo } from '@assets';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll for sticky navigation
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

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <span className="text-xl font-bold text-gray-900">CampusCuts</span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('how-it-works')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                How It Works
              </button>
              <button onClick={() => scrollToSection('for-barbers')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                For Barbers
              </button>
              <button onClick={() => scrollToSection('for-students')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                For Students
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
                Pricing
              </button>
            </div>

            {/* CTA Buttons - Desktop */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/web')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                Launch Web App
              </button>
              <button
                onClick={() => navigate('/app/install')}
                className="px-5 py-2 bg-primary-400 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Download App
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                How It Works
              </button>
              <button onClick={() => scrollToSection('for-barbers')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                For Barbers
              </button>
              <button onClick={() => scrollToSection('for-students')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                For Students
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                Pricing
              </button>
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <button onClick={() => navigate('/web')} className="block w-full px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  Launch Web App
                </button>
                <button onClick={() => navigate('/app/install')} className="block w-full px-4 py-2 bg-primary-400 hover:bg-primary-500 text-white rounded-lg transition-colors">
                  Download App
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
          <p className="text-2xl md:text-3xl text-gray-700 mb-4">
            Barbers earn 50% more. Students save 20%. Everyone wins.
          </p>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            We eliminated the expensive middleman. Barbers keep 95% instead of the typical 40-60% commission. 
            Students get quality haircuts at fair prices.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => navigate('/web')}
              className="px-8 py-4 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" />
              Launch Web App
            </button>
            <button
              onClick={() => navigate('/app/install')}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-gray-200 flex items-center justify-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              Download App
            </button>
          </div>

          <p className="text-sm text-gray-500">No credit card required • Free to use • iOS & Android</p>
        </div>
      </div>

      {/* Why CampusCuts Section */}
      <div className="py-20 px-4 bg-white" id="how-it-works">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why CampusCuts?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We eliminate the middleman and pass the savings to you. Fair prices for students, great earnings for barbers.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Barbers Keep 95%</h3>
              <p className="text-gray-600">
                Earn $26.60 per $28 haircut vs $17.50 per $35 at traditional shops. 
                That's 52% more earnings per cut with a 5% platform fee instead of 40-60% shop commission.
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Lower Prices for Students</h3>
              <p className="text-gray-600">
                Pay $28 instead of $35 for the same quality cut. Save 20% compared to traditional barbershops 
                while supporting barbers who earn more. Win-win economics.
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Instant Payments</h3>
              <p className="text-gray-600">
                Barbers get paid immediately after service completion. Secure escrow protects both parties during the booking.
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Direct Connection</h3>
              <p className="text-gray-600">
                Message barbers directly, see their work, check availability. Build relationships with your preferred barber.
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Quality Focused</h3>
              <p className="text-gray-600">
                Verified reviews, barber portfolios, and performance-based ranking ensure you always find top talent.
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">On-Campus Convenience</h3>
              <p className="text-gray-600">
                Get haircuts in your dorm, on campus, or at the barber's location. Flexible scheduling that works for students.
              </p>
            </Card>
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
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how CampusCuts transforms traditional barber economics to benefit everyone
            </p>
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

                  <div className="mt-6 p-4 bg-red-100 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Reality:</strong> Traditional shops take 40-60% commission. Industry average is ~50% split.
                    </p>
                  </div>
                </div>
              </Card>

              {/* CampusCuts Model */}
              <Card className="border-2 border-green-300 bg-green-50">
                <div className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">CampusCuts</h3>
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
                      <p className="text-xs text-green-600 mt-1 font-medium">$7 less than traditional!</p>
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

                  <div className="mt-6 p-4 bg-green-100 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Result:</strong> Barber earns $9.10 more per cut. Customer saves $7. Everyone wins!
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Key Insights */}
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-300">
              <div className="p-8">
                <h3 className="text-2xl font-bold text-center text-gray-900 mb-6">
                  Why This Works
                </h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600 mb-2">+52%</div>
                    <p className="text-gray-700 font-semibold mb-1">More Earnings</p>
                    <p className="text-sm text-gray-600">Barbers earn $26.60 vs $17.50 traditional</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">-20%</div>
                    <p className="text-gray-700 font-semibold mb-1">Lower Prices</p>
                    <p className="text-sm text-gray-600">Students pay $28 vs $35 traditional</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary-400 mb-2">5%</div>
                    <p className="text-gray-700 font-semibold mb-1">Platform Fee</p>
                    <p className="text-sm text-gray-600">vs 40-60% traditional shop take</p>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-white rounded-lg border border-primary-200">
                  <p className="text-center text-gray-700">
                    <strong>The Secret:</strong> No physical shop = no rent, utilities, or reception staff. 
                    We pass those savings directly to barbers and customers.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Real Data Source */}
          <div className="max-w-3xl mx-auto mt-8">
            <p className="text-center text-sm text-gray-500">
              Data based on industry reports showing traditional barbers earn 40-60% commission (median 50%) 
              and typical haircut prices of $25-$45 in U.S. markets.
            </p>
          </div>
        </div>
      </div>

      {/* For Barbers Section */}
      <div className="py-20 px-4 bg-white" id="for-barbers">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              For Barbers
            </h2>
            <p className="text-xl text-gray-600">
              Build your business on your terms. Keep what you earn.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-primary-400 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">1</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Create Your Profile</h4>
                  <p className="text-gray-600">Showcase your skills, set your prices, link your Instagram portfolio.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-primary-400 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">2</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Review Requests</h4>
                  <p className="text-gray-600">See customer reliability scores. Accept or decline requests on your terms.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-primary-400 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">3</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Complete Service</h4>
                  <p className="text-gray-600">Provide quality service at your chosen location. Mark booking as complete.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-primary-400 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">4</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Get Paid Instantly</h4>
                  <p className="text-gray-600">Receive 95% of the payment immediately. No waiting periods or hidden fees.</p>
                </div>
              </div>
            </div>

            <Card className="bg-gradient-to-br from-primary-50 to-primary-100 p-8">
              <h3 className="text-3xl font-bold text-primary-400 mb-4">For Barbers</h3>
              <p className="text-5xl font-bold text-gray-900 mb-4">Keep 95%</p>
              <p className="text-gray-700 text-lg mb-6">
                Most platforms take 20-30%. We only charge 5% so you can earn what you deserve while charging fair prices.
              </p>
              <button
                onClick={() => navigate('/web')}
                className="w-full px-6 py-3 bg-primary-400 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
              >
                Start Earning More
              </button>
            </Card>
          </div>
        </div>
      </div>

      {/* For Students Section */}
      <div className="py-20 px-4 bg-gradient-to-br from-blue-50 to-cyan-50" id="for-students">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              For Students
            </h2>
            <p className="text-xl text-gray-600">
              Quality cuts, fair prices, campus convenience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-100 p-8">
              <h3 className="text-3xl font-bold text-blue-600 mb-4">For Students</h3>
              <p className="text-5xl font-bold text-gray-900 mb-4">Save 20%</p>
              <p className="text-gray-700 text-lg mb-6">
                Lower platform fees mean barbers can offer great prices. Quality cuts from talented barbers, right on campus.
              </p>
              <button
                onClick={() => navigate('/web')}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Find Your Barber
              </button>
            </Card>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">1</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Browse Barbers</h4>
                  <p className="text-gray-600">Swipe through profiles, see ratings, portfolios, and Instagram.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">2</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Send Booking Request</h4>
                  <p className="text-gray-600">Choose date, time, and location. Message the barber directly.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">3</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Get Your Cut</h4>
                  <p className="text-gray-600">Meet at the agreed location. Payment processes automatically upon completion.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg">4</div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Leave a Review</h4>
                  <p className="text-gray-600">Your verified review helps build the barber's reputation and helps other students.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-20 px-4 bg-gradient-to-br from-primary-400 to-primary-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-primary-50 mb-10">
            Join the future of campus grooming. Fair prices, instant payments, direct connections.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/web')}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-primary-600 font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" />
              Launch Web Version
            </button>
            <button 
              onClick={() => navigate('/app/install')}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              Download Mobile App
            </button>
          </div>
        </div>
      </div>

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
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    Blog <span className="text-xs text-gray-600">(Coming Soon)</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* For You */}
            <div>
              <h4 className="font-bold text-white mb-4">For You</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => scrollToSection('for-barbers')} className="text-gray-400 hover:text-white transition-colors">
                    For Barbers
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('for-students')} className="text-gray-400 hover:text-white transition-colors">
                    For Students
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('pricing')} className="text-gray-400 hover:text-white transition-colors">
                    Pricing
                  </button>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    Help Center <span className="text-xs text-gray-600">(Coming Soon)</span>
                  </button>
                </li>
                <li>
                  <a href="mailto:support@campuscuts.com" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                    Contact Us <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    FAQ <span className="text-xs text-gray-600">(Coming Soon)</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    Privacy Policy <span className="text-xs text-gray-600">(Coming Soon)</span>
                  </button>
                </li>
                <li>
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    Terms of Service <span className="text-xs text-gray-600">(Coming Soon)</span>
                  </button>
                </li>
                <li>
                  <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                    GDPR <span className="text-xs text-gray-600">(Coming Soon)</span>
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
                <img src={CampusCutsLogo} alt="CampusCuts" className="h-8 w-auto" />
                <div>
                  <p className="text-gray-400 text-sm">
                    © 2025 CampusCuts. All rights reserved.
                  </p>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4">
                <a href="https://www.instagram.com/campuscutsslo/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                  <Twitter className="w-5 h-5" />
                </button>
                <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed">
                  <Github className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-center text-gray-500 text-sm mt-6">
              Connecting talented barbers with students since 2025 • Fair Pricing • Secure Payments • Campus Community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
