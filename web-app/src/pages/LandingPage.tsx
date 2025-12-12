/**
 * CampusCuts Landing Page
 * 
 * Main entry point explaining the decentralized platform
 * Provides options for Web Version or Mobile App
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, Shield, Zap, Users, Globe, CheckCircle } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { CampusCutsLogo } from '@assets';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-16">
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-20 w-auto mx-auto mb-6" />
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              CampusCuts
            </h1>
            <p className="text-2xl md:text-3xl text-gray-700 mb-3">
              Decentralized Campus Barbering
            </p>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The future of student grooming. Connect directly with talented barbers on campus through a trustless, blockchain-powered marketplace.
            </p>
          </div>

          {/* Platform Selection */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
            {/* Web Version */}
            <Card className="hover:shadow-2xl transition-shadow duration-300 cursor-pointer border-2 border-transparent hover:border-indigo-500"
                  onClick={() => navigate('/web')}>
              <div className="text-center p-8">
                <div className="bg-indigo-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Monitor className="w-12 h-12 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Web Version</h2>
                <p className="text-gray-600 mb-6">
                  Access CampusCuts from any browser. Perfect for desktop and laptop users who want the full experience.
                </p>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-lg py-4">
                  Launch Web App
                </Button>
                <p className="text-sm text-gray-500 mt-3">No installation required</p>
              </div>
            </Card>

            {/* Mobile App */}
            <Card className="hover:shadow-2xl transition-shadow duration-300 cursor-pointer border-2 border-transparent hover:border-purple-500"
                  onClick={() => navigate('/app')}>
              <div className="text-center p-8">
                <div className="bg-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Smartphone className="w-12 h-12 text-purple-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Mobile App</h2>
                <p className="text-gray-600 mb-6">
                  Install CampusCuts on your phone for on-the-go access. Works offline and sends push notifications.
                </p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-4">
                  Download App
                </Button>
                <p className="text-sm text-gray-500 mt-3">iOS & Android compatible</p>
              </div>
            </Card>
          </div>

          {/* Decentralized Features */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
              Why Decentralized?
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
              Built on the Aptos blockchain, CampusCuts eliminates middlemen, ensures transparency, and puts control directly in your hands.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Trustless Payments</h3>
                <p className="text-gray-600">
                  Smart contracts hold funds in escrow. No disputes, no chargebacks, no middleman taking a cut.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Instant Transactions</h3>
                <p className="text-gray-600">
                  Payments settle in seconds on Aptos. Barbers get paid immediately after service completion.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Community Owned</h3>
                <p className="text-gray-600">
                  No corporate control. The platform is governed by its users through transparent, on-chain rules.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Censorship Resistant</h3>
                <p className="text-gray-600">
                  Your account and reputation are yours forever. No one can ban you or delete your history.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Transparent Reviews</h3>
                <p className="text-gray-600">
                  All reviews are stored on-chain and immutable. See exactly what customers really think.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Self-Custodial</h3>
                <p className="text-gray-600">
                  You control your wallet and funds. Optional custodial service for ease of use.
                </p>
              </Card>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
              How CampusCuts Works
            </h2>
            
            <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
              {/* For Students */}
              <div>
                <h3 className="text-2xl font-bold text-indigo-600 mb-6">For Students</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Browse Barbers</h4>
                      <p className="text-gray-600">Swipe through profiles, see ratings, portfolios, and Instagram.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Send Booking Request</h4>
                      <p className="text-gray-600">Choose date, time, and location. Message the barber directly.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Get Your Cut</h4>
                      <p className="text-gray-600">Meet at the agreed location. Payment automatically releases from escrow.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Leave a Review</h4>
                      <p className="text-gray-600">Your on-chain review helps build the barber's reputation.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* For Barbers */}
              <div>
                <h3 className="text-2xl font-bold text-purple-600 mb-6">For Barbers</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Create Your Profile</h4>
                      <p className="text-gray-600">Showcase your skills, set your prices, link your Instagram.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Review Requests</h4>
                      <p className="text-gray-600">See customer reliability scores. Accept or decline requests.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Complete Service</h4>
                      <p className="text-gray-600">Provide quality service. Mark booking as complete.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Get Paid Instantly</h4>
                      <p className="text-gray-600">Smart contract releases payment to your wallet. No waiting.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Built on Aptos Blockchain</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              CampusCuts leverages the speed, security, and low cost of the Aptos blockchain to provide a seamless experience for both barbers and students.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <span className="px-6 py-3 bg-white rounded-full shadow-md text-gray-800 font-medium">Move Smart Contracts</span>
              <span className="px-6 py-3 bg-white rounded-full shadow-md text-gray-800 font-medium">IPFS Storage</span>
              <span className="px-6 py-3 bg-white rounded-full shadow-md text-gray-800 font-medium">Web3 Wallet Integration</span>
              <span className="px-6 py-3 bg-white rounded-full shadow-md text-gray-800 font-medium">Progressive Web App</span>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 mb-8">Choose your platform and experience the future of campus grooming.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/web')}
                className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-4"
              >
                <Monitor className="w-5 h-5 mr-2" />
                Launch Web Version
              </Button>
              <Button 
                onClick={() => navigate('/app')}
                className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-4"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Download Mobile App
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 mb-2">
            CampusCuts is a decentralized application. No corporate ownership, no central control.
          </p>
          <p className="text-gray-500 text-sm">
            Built with Move on Aptos • IPFS • Web3 • Open Source
          </p>
        </div>
      </footer>
    </div>
  );
}

