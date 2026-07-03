import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import webpageLogo from '../../assets/logos/Webpage_Logo copy.png';

export default function GDPRPage() {
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
            <img src={webpageLogo} alt="Tivela Platforms" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">Tivela Platforms</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Compliance</h1>
          <p className="text-gray-500 mb-4">Last Updated: {lastUpdated}</p>
          <p className="text-gray-600 mb-8">
            For users in the European Union (EU) and European Economic Area (EEA). This page outlines your rights under
            the General Data Protection Regulation (GDPR) when using Tivela Platforms, including our website, the Tivela iOS
            app, and the Tivela - Provider iOS app.
          </p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                Tivela Platforms is committed to complying with GDPR for users located in the EU and EEA. This page explains
                how we process your personal data and your rights. For a full description of the data we collect and
                how we use it, see our{' '}
                <Link to="/privacy" className="text-primary-600 hover:text-black underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Data Controller</h2>
              <p>
                Tivela Platforms is the data controller responsible for your personal data. For data protection inquiries,
                contact us at avilaplatformshelp@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Personal Data We Process</h2>
              <p>Depending on how you use the Service, we may process:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Identity and contact data (name, email, phone)</li>
                <li>Account and profile data (campus, role, photos, bio)</li>
                <li>Booking and transaction data (appointments, payments, tips)</li>
                <li>Communications data (messages, photos, support requests)</li>
                <li>Technical data (device, logs, IP address, cookies)</li>
                <li>Moderation and safety data (blocks, reports, enforcement actions)</li>
                <li>Optional calendar data when barbers connect Google Calendar</li>
                <li>Authentication data from Sign in with Apple when used</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Legal Basis for Processing</h2>
              <p>Under GDPR, we rely on the following legal bases:</p>

              <p className="font-semibold mt-4 mb-1">4.1 Contract Performance</p>
              <p>
                Processing necessary to provide the Service: account creation, bookings, payments, messaging, and
                customer support.
              </p>

              <p className="font-semibold mt-4 mb-1">4.2 Legitimate Interests</p>
              <p>
                Processing for platform security, fraud prevention, abuse detection, content moderation, analytics, and
                service improvement where it does not override your rights.
              </p>

              <p className="font-semibold mt-4 mb-1">4.3 Consent</p>
              <p>
                Processing based on your explicit consent: marketing communications, optional Google Calendar
                connection, and non-essential cookies where applicable.
              </p>

              <p className="font-semibold mt-4 mb-1">4.4 Legal Obligation</p>
              <p>Processing required by law: tax records, regulatory requests, and legal compliance.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Sub-Processors</h2>
              <p>
                We use trusted third-party providers to operate the Service. These may process personal data on our
                behalf, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Stripe (payments and payouts)</li>
                <li>Apple (Sign in with Apple authentication)</li>
                <li>Google (optional Calendar integration for barbers)</li>
                <li>Cloud infrastructure and email delivery providers</li>
              </ul>
              <p className="mt-3">
                We require appropriate data processing agreements with sub-processors and limit their use of data to
                providing services to Tivela Platforms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your GDPR Rights</h2>
              <p>Under GDPR, you have the following rights:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>
                  <strong>Right to Access (Article 15):</strong> Request a copy of personal data we hold about you.
                </li>
                <li>
                  <strong>Right to Rectification (Article 16):</strong> Request correction of inaccurate or incomplete
                  data.
                </li>
                <li>
                  <strong>Right to Erasure (Article 17):</strong> Request deletion when data is no longer necessary or
                  consent is withdrawn.
                </li>
                <li>
                  <strong>Right to Restrict Processing (Article 18):</strong> Request limits on processing while we
                  verify data or legitimacy.
                </li>
                <li>
                  <strong>Right to Data Portability (Article 20):</strong> Receive your data in a structured,
                  machine-readable format.
                </li>
                <li>
                  <strong>Right to Object (Article 21):</strong> Object to processing based on legitimate interests or
                  direct marketing.
                </li>
                <li>
                  <strong>Right to Withdraw Consent (Article 7):</strong> Withdraw consent at any time without affecting
                  prior lawful processing.
                </li>
                <li>
                  <strong>Right to Lodge a Complaint (Article 77):</strong> File a complaint with your supervisory
                  authority.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. How to Exercise Your Rights</h2>
              <p>To exercise any GDPR rights, contact us at:</p>
              <p className="mt-2">Email: avilaplatformshelp@gmail.com</p>
              <p className="mt-2">
                Include &quot;GDPR Request&quot; in the subject line and provide enough information to verify your
                identity. We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. International Data Transfers</h2>
              <p>
                Our servers are located in the United States. If you access the Service from the EU/EEA, your data may
                be transferred to the US. We use appropriate safeguards, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
                <li>Adequacy decisions where applicable</li>
                <li>Data processing agreements with sub-processors</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Data Retention</h2>
              <p>We retain personal data only as long as necessary:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Active accounts: data retained while the account is active</li>
                <li>After deletion: core data deleted within 30 days; some data retained for legal compliance (up to 7 years for financial records)</li>
                <li>Moderation records: retained as needed for safety and legal obligations</li>
                <li>Backups: removed from backup systems within 90 days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">10. Data Security Measures</h2>
              <p>We implement technical and organizational measures to protect your data:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Encryption in transit (TLS) and at rest for sensitive data</li>
                <li>Access controls based on least privilege</li>
                <li>Secure payment processing through Stripe</li>
                <li>Incident response procedures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">11. Data Breach Notification</h2>
              <p>In the event of a personal data breach that poses a high risk to your rights and freedoms, we will:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Notify the relevant supervisory authority within 72 hours where required</li>
                <li>Notify affected individuals without undue delay when required</li>
                <li>Document the breach and remediation steps taken</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">12. Contact Information</h2>
              <p>For GDPR-related questions or to exercise your rights:</p>
              <p className="mt-2">Email: avilaplatformshelp@gmail.com</p>
              <p className="mt-1">Subject line: GDPR Request - [Your Request Type]</p>
            </section>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link to="/terms" className="text-gray-600 hover:text-gray-900">
            Terms of Service
          </Link>
          <span className="text-gray-400">|</span>
          <Link to="/privacy" className="text-gray-600 hover:text-gray-900">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
