/**
 * CampusCuts Landing Page
 * 
 * Main entry point explaining the platform
 * Provides options for Web Version or Mobile App
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, DollarSign, Zap, Users, Star, CheckCircle, TrendingUp } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { CampusCutsLogo } from '@assets';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-50 to-pink-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-16">
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-20 w-auto mx-auto mb-6" />
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              CampusCuts
            </h1>
            <p className="text-3xl md:text-4xl font-bold text-primary-400 mb-3">
              Earn More, Lower Prices
            </p>
            <p className="text-xl md:text-2xl text-gray-700 mb-4">
              Barbers earn 50% more. Students save 20%. Everyone wins.
            </p>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We eliminated the expensive middleman. Barbers keep 95% instead of the typical 40-60% commission. 
              Students get quality haircuts at fair prices.
            </p>
          </div>

          {/* Platform Selection */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
            {/* Web Version */}
            <Card className="hover:shadow-2xl transition-shadow duration-300 cursor-pointer border-2 border-transparent hover:border-primary-500"
                  onClick={() => navigate('/web')}>
              <div className="text-center p-8">
                <div className="bg-primary-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Monitor className="w-12 h-12 text-primary-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Web Version</h2>
                <p className="text-gray-600 mb-6">
                  Access CampusCuts from any browser. Perfect for desktop and laptop users who want the full experience.
                </p>
                <Button className="w-full bg-primary-400 hover:bg-primary-500 text-lg py-4">
                  Launch Web App
                </Button>
                <p className="text-sm text-gray-500 mt-3">No installation required</p>
              </div>
            </Card>

            {/* Mobile App */}
            <Card className="hover:shadow-2xl transition-shadow duration-300 cursor-pointer border-2 border-transparent hover:border-primary-500"
                  onClick={() => navigate('/app')}>
              <div className="text-center p-8">
                <div className="bg-primary-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Smartphone className="w-12 h-12 text-primary-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Mobile App</h2>
                <p className="text-gray-600 mb-6">
                  Install CampusCuts on your phone for on-the-go access. Works offline and sends push notifications.
                </p>
                <Button className="w-full bg-primary-400 hover:bg-primary-500 text-lg py-4">
                  Download App
                </Button>
                <p className="text-sm text-gray-500 mt-3">iOS & Android compatible</p>
              </div>
            </Card>
          </div>

          {/* Key Benefits */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
              Why CampusCuts?
            </h2>
            <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
              We eliminate the middleman and pass the savings to you. Fair prices for students, great earnings for barbers.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Barbers Keep 95%</h3>
                <p className="text-gray-600">
                  Earn $26.60 per $28 haircut vs $17.50 per $35 at traditional shops. 
                  That's 52% more earnings per cut with a 5% platform fee instead of 40-60% shop commission.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Lower Prices for Students</h3>
                <p className="text-gray-600">
                  Pay $28 instead of $35 for the same quality cut. Save 20% compared to traditional barbershops 
                  while supporting barbers who earn more. Win-win economics.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Instant Payments</h3>
                <p className="text-gray-600">
                  Barbers get paid immediately after service completion. Secure escrow protects both parties during the booking.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Direct Connection</h3>
                <p className="text-gray-600">
                  Message barbers directly, see their work, check availability. Build relationships with your preferred barber.
                </p>
              </Card>

              <Card className="text-center">
                <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Quality Focused</h3>
                <p className="text-gray-600">
                  Verified reviews, barber portfolios, and performance-based ranking ensure you always find top talent.
                </p>
              </Card>

              <Card className="text-center">
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

          {/* Economic Comparison - The Math Behind "Earn More, Lower Prices" */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Earn More, Lower Prices
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

            {/* Game-Changing Insight: Our Minimum > Their Maximum */}
            <div className="max-w-5xl mx-auto mt-12">
              <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400">
                <div className="p-8">
                  <div className="text-center mb-6">
                    <div className="inline-block bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm mb-4">
                      💡 GAME CHANGER
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">
                      Our Minimum Beats Their Maximum
                    </h3>
                    <p className="text-lg text-gray-700">
                      Even entry-level barbers on CampusCuts earn more than top performers at traditional shops
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Traditional BEST Case */}
                    <div className="bg-white rounded-lg p-6 border-2 border-red-300">
                      <div className="text-center mb-4">
                        <h4 className="font-bold text-lg text-gray-900 mb-1">Traditional Barbershop</h4>
                        <p className="text-sm text-red-600 font-semibold">BEST CASE SCENARIO</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Customer pays premium price</p>
                          <p className="text-2xl font-bold text-gray-900">$35</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Top barber negotiates 60% split</p>
                          <p className="text-lg text-gray-700">(Best commission rate)</p>
                        </div>
                        <div className="pt-3 border-t-2 border-red-200">
                          <p className="text-sm text-gray-600 mb-1">Maximum Earnings:</p>
                          <p className="text-4xl font-bold text-red-600">$21.00</p>
                        </div>
                      </div>
                    </div>

                    {/* CampusCuts MINIMUM */}
                    <div className="bg-white rounded-lg p-6 border-2 border-green-400">
                      <div className="text-center mb-4">
                        <h4 className="font-bold text-lg text-gray-900 mb-1">CampusCuts</h4>
                        <p className="text-sm text-green-600 font-semibold">MINIMUM PRICING</p>
                      </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">New barber charges budget price</p>
                        <p className="text-2xl font-bold text-gray-900">$23</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Everyone keeps 95%</p>
                        <p className="text-lg text-gray-700">(Standard platform rate)</p>
                      </div>
                      <div className="pt-3 border-t-2 border-green-300">
                        <p className="text-sm text-gray-600 mb-1">Minimum Earnings:</p>
                        <p className="text-4xl font-bold text-green-600">$21.85</p>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 border-2 border-yellow-400">
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Traditional MAX</p>
                        <p className="text-2xl font-bold text-red-600">$21.00</p>
                      </div>
                      <div className="text-3xl font-bold text-green-600">{'<'}</div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">CampusCuts MIN</p>
                        <p className="text-2xl font-bold text-green-600">$21.85</p>
                      </div>
                    </div>
                    <p className="text-center text-gray-700 font-semibold">
                      Our floor beats their ceiling. Every barber wins, regardless of experience level.
                    </p>
                  </div>

                  <div className="mt-6 grid md:grid-cols-3 gap-4">
                    <div className="bg-yellow-100 rounded-lg p-4 text-center">
                      <p className="font-bold text-gray-900 mb-1">New Barbers</p>
                      <p className="text-sm text-gray-600">Start earning more than traditional veterans</p>
                    </div>
                    <div className="bg-yellow-100 rounded-lg p-4 text-center">
                      <p className="font-bold text-gray-900 mb-1">Experienced Barbers</p>
                      <p className="text-sm text-gray-600">Charge $35+ and keep $33.25+ per cut</p>
                    </div>
                    <div className="bg-yellow-100 rounded-lg p-4 text-center">
                      <p className="font-bold text-gray-900 mb-1">No Negotiation</p>
                      <p className="text-sm text-gray-600">95% rate for everyone, always</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Real Data Source */}
            <div className="max-w-3xl mx-auto mt-8">
              <p className="text-center text-sm text-gray-500">
                Data based on industry reports showing traditional barbers earn 40-60% commission (median 50%) 
                and typical haircut prices of $25-$45 in U.S. markets. Sources: Sheets.Market, BusinessDojo, 
                Salon & Barbers Connect industry studies.
              </p>
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
                <h3 className="text-2xl font-bold text-primary-400 mb-6">For Students</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Browse Barbers</h4>
                      <p className="text-gray-600">Swipe through profiles, see ratings, portfolios, and Instagram.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Send Booking Request</h4>
                      <p className="text-gray-600">Choose date, time, and location. Message the barber directly.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Get Your Cut</h4>
                      <p className="text-gray-600">Meet at the agreed location. Payment processes automatically upon completion.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Leave a Review</h4>
                      <p className="text-gray-600">Your verified review helps build the barber's reputation and helps other students.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* For Barbers */}
              <div>
                <h3 className="text-2xl font-bold text-primary-400 mb-6">For Barbers</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Create Your Profile</h4>
                      <p className="text-gray-600">Showcase your skills, set your prices, link your Instagram.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Review Requests</h4>
                      <p className="text-gray-600">See customer reliability scores. Accept or decline requests.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Complete Service</h4>
                      <p className="text-gray-600">Provide quality service. Mark booking as complete.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-primary-400 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Get Paid Instantly</h4>
                      <p className="text-gray-600">Receive 95% of the payment immediately. No waiting periods or hidden fees.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="text-center mb-12 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-gradient-to-br from-primary-50 to-primary-50">
                <h3 className="text-3xl font-bold text-primary-400 mb-2">For Barbers</h3>
                <p className="text-5xl font-bold text-gray-900 mb-2">Keep 95%</p>
                <p className="text-gray-600">
                  Most platforms take 20-30%. We only charge 5% so you can earn what you deserve while charging fair prices.
                </p>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
                <h3 className="text-3xl font-bold text-blue-600 mb-2">For Students</h3>
                <p className="text-5xl font-bold text-gray-900 mb-2">Save 30%</p>
                <p className="text-gray-600">
                  Lower platform fees mean barbers can offer great prices. Quality cuts from talented students, right on campus.
                </p>
              </Card>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 mb-8">Choose your platform and experience the future of campus grooming.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate('/web')}
                className="bg-primary-400 hover:bg-primary-500 text-lg px-8 py-4"
              >
                <Monitor className="w-5 h-5 mr-2" />
                Launch Web Version
              </Button>
              <Button 
                onClick={() => navigate('/app')}
                className="bg-primary-400 hover:bg-primary-500 text-lg px-8 py-4"
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
            CampusCuts - Connecting talented barbers with students since 2025
          </p>
          <p className="text-gray-500 text-sm">
            Fair Pricing • Secure Payments • Campus Community
          </p>
        </div>
      </footer>
    </div>
  );
}

