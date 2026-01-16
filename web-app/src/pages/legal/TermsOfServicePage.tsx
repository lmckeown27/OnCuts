import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import MainChairLogo from '../../assets/logos/Main_Chair.webp';

export default function TermsOfServicePage() {
  const lastUpdated = "December 23, 2024";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={MainChairLogo} alt="CampusCut" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">CampusCut</span>
          </Link>
          <Link 
            to="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Terms of Service</h1>
          </div>
          
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                Welcome to CampusCut ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of the CampusCut platform, including our website, mobile applications, and all related services (collectively, the "Service").
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Service.
              </p>
            </section>

            {/* Description of Service */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-700 leading-relaxed">
                CampusCut is a marketplace platform that connects consumers seeking grooming services ("Consumers") with independent barbers offering their services ("Barbers"). We facilitate:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Discovery and browsing of barber profiles and services</li>
                <li>Booking and scheduling of appointments</li>
                <li>Secure payment processing</li>
                <li>Reviews and ratings</li>
                <li>Communication between Consumers and Barbers</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>Important:</strong> CampusCut is a platform that connects users. We are not a grooming service provider. Barbers are independent contractors, not employees of CampusCut.
              </p>
            </section>

            {/* Account Registration */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Account Registration</h2>
              <p className="text-gray-700 leading-relaxed">
                To use certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You must be at least 18 years old to create an account. By creating an account, you represent and warrant that you meet this age requirement.
              </p>
            </section>

            {/* Consumer Terms */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Consumer Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                As a Consumer using the Service, you agree to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Provide accurate booking information including preferred date, time, and location</li>
                <li>Arrive on time for scheduled appointments</li>
                <li>Cancel or reschedule appointments with reasonable notice</li>
                <li>Treat Barbers with respect and professionalism</li>
                <li>Pay the agreed-upon price for services rendered</li>
                <li>Leave honest and fair reviews based on actual experiences</li>
              </ul>
            </section>

            {/* Barber Terms */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Barber Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                As a Barber using the Service, you agree to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Maintain accurate and up-to-date profile information, including services and pricing</li>
                <li>Respond to booking requests in a timely manner</li>
                <li>Honor confirmed bookings and arrive on time</li>
                <li>Provide professional, quality services</li>
                <li>Comply with all applicable laws, regulations, and licensing requirements</li>
                <li>Maintain appropriate insurance coverage as required by law</li>
                <li>Treat Consumers with respect and professionalism</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Barbers are independent contractors and are solely responsible for their services, business practices, tax obligations, and compliance with applicable laws.
              </p>
            </section>

            {/* Payments and Fees */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Payments and Fees</h2>
              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.1 Payment Processing</h3>
              <p className="text-gray-700 leading-relaxed">
                All payments are processed securely through Stripe, our third-party payment processor. By using the Service, you agree to Stripe's terms of service. We do not store your full credit card information on our servers.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.2 Payouts to Barbers</h3>
              <p className="text-gray-700 leading-relaxed">
                Barbers receive payments for each completed booking. Payments are released after the service is marked as complete. Payout timing may vary based on payment processor policies.
              </p>
            </section>

            {/* Cancellations and Refunds */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Cancellations and Refunds</h2>
              <p className="text-gray-700 leading-relaxed">
                Cancellation policies are set by individual Barbers. We encourage both parties to communicate promptly regarding any changes to scheduled appointments. Refund eligibility depends on:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>The timing of the cancellation</li>
                <li>The reason for cancellation</li>
                <li>The Barber's posted cancellation policy</li>
                <li>Whether the service was partially or fully rendered</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Disputes between Consumers and Barbers should first be attempted to be resolved directly. CampusCut may assist in mediation but is not obligated to issue refunds.
              </p>
            </section>

            {/* User Conduct */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. User Conduct</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Use the Service for any illegal purpose</li>
                <li>Harass, abuse, or harm another person</li>
                <li>Provide false or misleading information</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use automated systems to access the Service without permission</li>
                <li>Circumvent the platform to avoid fees</li>
                <li>Post fraudulent reviews or ratings</li>
                <li>Discriminate against any user based on protected characteristics</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service and its original content, features, and functionality are owned by CampusCut and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                By posting content (including profile information, portfolio images, and reviews), you grant CampusCut a non-exclusive, worldwide, royalty-free license to use, display, and distribute such content in connection with the Service.
              </p>
            </section>

            {/* Disclaimer of Warranties */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Disclaimer of Warranties</h2>
              <p className="text-gray-700 leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                WE DO NOT ENDORSE, WARRANT, OR GUARANTEE ANY BARBER'S SERVICES, QUALIFICATIONS, OR WORK QUALITY. YOU USE THE SERVICE AND ENGAGE WITH BARBERS AT YOUR OWN RISK.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAMPUSCUT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify, defend, and hold harmless CampusCut and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Termination</h2>
              <p className="text-gray-700 leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which should survive termination shall survive.
              </p>
            </section>

            {/* Changes to Terms */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                Your continued use of the Service after any changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:campuscuthelp@gmail.com" className="text-primary-500 hover:underline">
                    campuscuthelp@gmail.com
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link 
            to="/privacy" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Privacy Policy →
          </Link>
          <Link 
            to="/gdpr" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            GDPR →
          </Link>
        </div>
      </div>
    </div>
  );
}

