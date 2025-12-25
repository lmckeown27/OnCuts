import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import MainChairLogo from '../../assets/logos/Main_Chair.png';

export default function PrivacyPolicyPage() {
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
            <Shield className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                CampusCut is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, website, and mobile applications (collectively, the "Service").
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Account Information:</strong> Name, email address, password (encrypted)</li>
                <li><strong>Profile Information:</strong> Profile photo, bio, campus affiliation</li>
                <li><strong>Barber-Specific Information:</strong> Services offered, pricing, availability, portfolio images, business location</li>
                <li><strong>Booking Information:</strong> Appointment dates, times, services requested, special instructions</li>
                <li><strong>Payment Information:</strong> Payment method details (processed securely by Stripe)</li>
                <li><strong>Communications:</strong> Messages sent through our platform, customer support inquiries</li>
                <li><strong>Reviews and Ratings:</strong> Feedback you leave for other users</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Device Information:</strong> Device type, operating system, browser type, unique device identifiers</li>
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the platform</li>
                <li><strong>Location Data:</strong> General location based on IP address; precise location only if you grant permission</li>
                <li><strong>Log Data:</strong> IP address, access times, referring URLs, error logs</li>
                <li><strong>Cookies and Tracking:</strong> Session cookies, authentication tokens, analytics data</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Information from Third Parties</h3>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Payment Processors:</strong> Transaction status and confirmation from Stripe</li>
                <li><strong>Social Media:</strong> If you choose to link social accounts (e.g., Instagram for portfolio)</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process bookings and payments</li>
                <li>Facilitate communication between Consumers and Barbers</li>
                <li>Send transactional notifications (booking confirmations, reminders, receipts)</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Personalize your experience and recommend relevant barbers</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Detect, prevent, and address fraud and security issues</li>
                <li>Comply with legal obligations</li>
                <li>Respond to customer support requests</li>
              </ul>
            </section>

            {/* How We Share Your Information */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. How We Share Your Information</h2>
              <p className="text-gray-700 leading-relaxed">
                We may share your information in the following circumstances:
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 With Other Users</h3>
              <p className="text-gray-700 leading-relaxed">
                Consumers and Barbers can see each other's profile information, reviews, and booking details as necessary to facilitate appointments.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 With Service Providers</h3>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Stripe:</strong> Payment processing</li>
                <li><strong>Cloud Hosting:</strong> Data storage and server infrastructure</li>
                <li><strong>Analytics Providers:</strong> Usage analysis and improvement</li>
                <li><strong>Communication Services:</strong> Email and push notification delivery</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.3 For Legal Reasons</h3>
              <p className="text-gray-700 leading-relaxed">
                We may disclose your information if required by law, subpoena, or other legal process, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.4 Business Transfers</h3>
              <p className="text-gray-700 leading-relaxed">
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
              </p>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Encryption of data in transit (HTTPS/TLS)</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Password hashing using bcrypt</li>
                <li>Secure payment processing via Stripe (PCI-DSS compliant)</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls limiting employee access to personal data</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                While we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide you services. We may retain certain information for longer periods as required by law or for legitimate business purposes, such as:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Transaction records for tax and accounting purposes</li>
                <li>Communications related to disputes or legal matters</li>
                <li>Anonymized and aggregated data for analytics</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)</li>
                <li><strong>Portability:</strong> Request your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Restrict Processing:</strong> Request limitations on how we use your data</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise these rights, contact us at{' '}
                <a href="mailto:campuscuthelp@gmail.com" className="text-primary-500 hover:underline">
                  campuscuthelp@gmail.com
                </a>.
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookies and Tracking</h2>
              <p className="text-gray-700 leading-relaxed">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Analyze how our service is used</li>
                <li>Improve user experience</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You can control cookies through your browser settings. Note that disabling cookies may affect the functionality of the Service.
              </p>
            </section>

            {/* Third-Party Links */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Third-Party Links</h2>
              <p className="text-gray-700 leading-relaxed">
                Our Service may contain links to third-party websites or services (e.g., Instagram portfolios, Stripe). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </p>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete it.
              </p>
            </section>

            {/* Changes to This Policy */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. Material changes may be communicated via email or through the Service.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at:
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
            to="/terms" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Terms of Service →
          </Link>
          <Link 
            to="/gdpr" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            GDPR →
          </Link>
          <Link 
            to="/help" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Help Center →
          </Link>
        </div>
      </div>
    </div>
  );
}

