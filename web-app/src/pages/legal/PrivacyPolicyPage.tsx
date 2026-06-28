import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import webpageLogo from '../../assets/logos/Webpage_Logo copy.png';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const lastUpdated = 'June 17, 2026';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={webpageLogo} alt="PismoPlatforms" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">PismoPlatforms</span>
          </Link>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                PismoPlatforms is committed to protecting your privacy. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our website, the PismoPlatforms iOS app for consumers,
                the Pismo - Provider iOS app for barbers, and related services (collectively, the &quot;Service&quot;).
              </p>
              <p className="mt-3">
                Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of
                information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>

              <p className="font-semibold mt-4 mb-2">2.1 Information You Provide</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account Information: Name, email address, password (encrypted), phone number when provided</li>
                <li>Profile Information: Profile photo, bio, campus affiliation</li>
                <li>Barber Information: Services, pricing, availability, portfolio images, business locations</li>
                <li>Booking Information: Appointment dates, times, services requested, locations, notes</li>
                <li>Payment Information: Payment method details processed by Stripe (we do not store full card numbers)</li>
                <li>Communications: Messages, photos, and support inquiries sent through the Service</li>
                <li>Reviews and Ratings: Feedback you leave for other users</li>
                <li>Application Information: Information submitted in barber applications</li>
              </ul>

              <p className="font-semibold mt-4 mb-2">2.2 Information Collected Automatically</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Device Information: Device type, operating system, browser type, app version</li>
                <li>Usage Data: Pages or screens visited, features used, interaction logs</li>
                <li>Location Data: General location based on IP address; precise location only with permission</li>
                <li>Log Data: IP address, access times, referring URLs, error logs</li>
                <li>Cookies and Tokens: Session cookies, authentication tokens, preference data</li>
              </ul>

              <p className="font-semibold mt-4 mb-2">2.3 Information from Third Parties</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Stripe: Payment status, transaction confirmations, payout data</li>
                <li>Apple: Sign in with Apple identity token, email, and name when you choose Apple authentication</li>
                <li>Google: Calendar busy/free data when you connect Google Calendar (barbers only)</li>
                <li>Social Media: Public profile or portfolio links you choose to display (e.g., Instagram)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process bookings, reschedules, cancellations, and payments</li>
                <li>Facilitate communication between Consumers and Barbers</li>
                <li>Review barber applications and administer the platform</li>
                <li>Send transactional notifications (confirmations, reminders, receipts)</li>
                <li>Send promotional communications with your consent</li>
                <li>Detect, prevent, and address fraud, abuse, and security issues</li>
                <li>Enforce community standards, including content moderation and account actions</li>
                <li>Comply with legal obligations</li>
                <li>Respond to customer support requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Share Your Information</h2>
              <p>We may share your information in the following circumstances:</p>

              <p className="font-semibold mt-4 mb-2">4.1 With Other Users</p>
              <p>
                Consumers and Barbers can see profile information, reviews, and booking details needed to complete
                appointments. Messages you send are visible to the intended recipient.
              </p>

              <p className="font-semibold mt-4 mb-2">4.2 With Service Providers</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Stripe: Payment processing and payouts</li>
                <li>Apple and Google: Authentication and optional calendar integration</li>
                <li>Cloud Hosting: Data storage and infrastructure</li>
                <li>Email Services: Transactional and support email delivery</li>
              </ul>

              <p className="font-semibold mt-4 mb-2">4.3 For Legal and Safety Reasons</p>
              <p>
                We may disclose information if required by law or if we believe disclosure is necessary to protect
                rights, safety, or to investigate fraud or abuse.
              </p>

              <p className="font-semibold mt-4 mb-2">4.4 Business Transfers</p>
              <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part
                of that transaction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. User-Generated Content and Moderation</h2>
              <p>
                The Service includes user-generated content such as messages, photos, reviews, and profile material. We
                may use automated filters, user reports, and manual review to enforce community standards.
              </p>
              <p className="mt-3">
                If you block another user, we store that block so the two accounts cannot interact. If you report
                content, we store report details to investigate and respond. We may retain moderation records, including
                reports and enforcement actions, as needed for safety and legal compliance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
              <p>We implement industry-standard security measures to protect your information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Encryption of data in transit (HTTPS/TLS)</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Password hashing using bcrypt</li>
                <li>Secure payment processing via Stripe (PCI-DSS compliant)</li>
                <li>Access controls limiting employee access to personal data</li>
              </ul>
              <p className="mt-3">
                While we strive to protect your information, no method of transmission over the Internet or electronic
                storage is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide the
                Service. We may retain certain information longer as required by law or for legitimate business
                purposes, such as:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Transaction records for tax and accounting purposes</li>
                <li>Communications related to disputes, safety, or legal matters</li>
                <li>Moderation and enforcement records</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Your Rights</h2>
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access: Request a copy of your personal data</li>
                <li>Correction: Request correction of inaccurate data</li>
                <li>Deletion: Request deletion of your data (subject to legal requirements)</li>
                <li>Portability: Request your data in a portable format</li>
                <li>Opt-Out: Unsubscribe from marketing communications</li>
                <li>Restrict Processing: Request limitations on how we use your data</li>
              </ul>
              <p className="mt-3">
                EU/EEA users: see our{' '}
                <Link to="/gdpr" className="text-primary-600 hover:text-black underline">
                  GDPR page
                </Link>{' '}
                for additional rights. To exercise any rights, contact us at avilaplatformshelp@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Cookies and Tracking</h2>
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Improve user experience</li>
              </ul>
              <p className="mt-3">
                You can control cookies through your browser settings. Disabling cookies may affect Service
                functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">10. Third-Party Links</h2>
              <p>
                Our Service may contain links to third-party websites or services (e.g., Instagram portfolios, Stripe,
                App Store pages). We are not responsible for the privacy practices of these third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">11. Google API Services</h2>
              <p>
                PismoPlatforms offers optional Google Calendar integration for barbers. When you connect your Google
                Calendar:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>We read busy/free times to prevent double-booking</li>
                <li>We may create calendar events for PismoPlatforms appointments with your permission</li>
                <li>We store a secure OAuth refresh token to maintain the connection</li>
                <li>You can disconnect Google Calendar at any time from Pismo - Provider or your barber dashboard</li>
              </ul>
              <p className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
                <strong>Limited Use Disclosure:</strong> PismoPlatforms&apos;s use and transfer of information received from
                Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-black underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">12. Children&apos;s Privacy</h2>
              <p>
                The Service is not intended for users under 18 years of age. We do not knowingly collect personal
                information from children. If we become aware that we have collected data from a child, we will take
                steps to delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will post the updated policy on this page and
                update the &quot;Last Updated&quot; date. Material changes may be communicated via email or through the
                Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at:</p>
              <p className="mt-2">Email: avilaplatformshelp@gmail.com</p>
            </section>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link to="/terms" className="text-gray-600 hover:text-gray-900">
            Terms of Service
          </Link>
          <span className="text-gray-400">|</span>
          <Link to="/gdpr" className="text-gray-600 hover:text-gray-900">
            GDPR
          </Link>
        </div>
      </div>
    </div>
  );
}
