import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, Mail } from 'lucide-react';
import MainChairLogo from '../../assets/logos/Main_Chair.png';

export default function GDPRPage() {
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
            <Globe className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">GDPR Compliance</h1>
          </div>
          
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          {/* GDPR Notice Banner */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 rounded-r-lg">
            <p className="text-blue-800 font-medium">
              For Users in the European Union (EU) and European Economic Area (EEA)
            </p>
            <p className="text-blue-700 text-sm mt-1">
              This page outlines your rights under the General Data Protection Regulation (GDPR).
            </p>
          </div>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                CampusCut is committed to complying with the General Data Protection Regulation (GDPR) for users located in the European Union (EU) and European Economic Area (EEA). This page explains how we process your personal data and your rights under GDPR.
              </p>
            </section>

            {/* Data Controller */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Data Controller</h2>
              <p className="text-gray-700 leading-relaxed">
                CampusCut is the data controller responsible for your personal data. For any data protection inquiries, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 flex items-center gap-2">
                  <Mail size={18} className="text-primary-500" />
                  <a href="mailto:campuscuthelp@gmail.com" className="text-primary-500 hover:underline">
                    campuscuthelp@gmail.com
                  </a>
                </p>
              </div>
            </section>

            {/* Legal Basis for Processing */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Legal Basis for Processing</h2>
              <p className="text-gray-700 leading-relaxed">
                Under GDPR, we must have a legal basis for processing your personal data. We rely on the following:
              </p>

              <div className="mt-6 space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800">Contract Performance</h4>
                  <p className="text-green-700 text-sm mt-1">
                    Processing necessary to provide our services: account creation, booking management, payment processing, communications between users.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800">Legitimate Interests</h4>
                  <p className="text-blue-700 text-sm mt-1">
                    Processing for platform improvement, fraud prevention, security, and analytics (where it does not override your rights).
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-800">Consent</h4>
                  <p className="text-purple-700 text-sm mt-1">
                    Processing based on your explicit consent: marketing communications, optional features, cookies beyond essential functionality.
                  </p>
                </div>

                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800">Legal Obligation</h4>
                  <p className="text-orange-700 text-sm mt-1">
                    Processing required by law: tax records, fraud investigations, regulatory compliance.
                  </p>
                </div>
              </div>
            </section>

            {/* Your GDPR Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Your GDPR Rights</h2>
              <p className="text-gray-700 leading-relaxed">
                Under GDPR, you have the following rights:
              </p>

              <div className="mt-6 space-y-6">
                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Access (Article 15)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can request a copy of all personal data we hold about you, including how it is processed and with whom it is shared.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Rectification (Article 16)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can request correction of inaccurate or incomplete personal data.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Erasure (Article 17)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can request deletion of your personal data when it is no longer necessary, you withdraw consent, or you object to processing.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Restrict Processing (Article 18)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can request limitations on how we process your data while we verify its accuracy or legitimacy of processing.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Data Portability (Article 20)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can request your data in a structured, machine-readable format and transfer it to another service provider.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Object (Article 21)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You can object to processing based on legitimate interests or for direct marketing purposes.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Withdraw Consent (Article 7)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Where we rely on your consent, you can withdraw it at any time without affecting prior processing.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4">
                  <h4 className="font-semibold text-gray-900">Right to Lodge a Complaint (Article 77)</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    You have the right to file a complaint with a supervisory authority in your country of residence.
                  </p>
                </div>
              </div>
            </section>

            {/* How to Exercise Your Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. How to Exercise Your Rights</h2>
              <p className="text-gray-700 leading-relaxed">
                To exercise any of your GDPR rights, please contact us at:
              </p>
              <div className="mt-4 p-6 bg-gray-50 rounded-lg">
                <p className="text-gray-700 mb-4">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:campuscuthelp@gmail.com" className="text-primary-500 hover:underline">
                    campuscuthelp@gmail.com
                  </a>
                </p>
                <p className="text-gray-600 text-sm">
                  Please include GDPR Request in the subject line and provide sufficient information to verify your identity. We will respond within 30 days.
                </p>
              </div>
            </section>

            {/* International Data Transfers */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. International Data Transfers</h2>
              <p className="text-gray-700 leading-relaxed">
                Our servers are located in the United States. If you are accessing the Service from the EU/EEA, your data will be transferred to the US. We ensure appropriate safeguards are in place:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
                <li>Adequacy decisions where applicable</li>
                <li>Data processing agreements with all sub-processors</li>
              </ul>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain personal data only for as long as necessary:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li><strong>Active accounts:</strong> Data retained while account is active</li>
                <li><strong>After account deletion:</strong> Core data deleted within 30 days; some data retained for legal compliance (up to 7 years for financial records)</li>
                <li><strong>Backups:</strong> Removed from backup systems within 90 days</li>
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Data Security Measures</h2>
              <p className="text-gray-700 leading-relaxed">
                We implement technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                <li>Regular security assessments and penetration testing</li>
                <li>Access controls based on principle of least privilege</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
                <li>Secure development practices</li>
              </ul>
            </section>

            {/* Data Breach Notification */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Data Breach Notification</h2>
              <p className="text-gray-700 leading-relaxed">
                In the event of a personal data breach that poses a high risk to your rights and freedoms, we will:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-700">
                <li>Notify the relevant supervisory authority within 72 hours</li>
                <li>Notify affected individuals without undue delay</li>
                <li>Document the breach and remediation steps taken</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                For any GDPR-related questions or to exercise your rights:
              </p>
              <div className="mt-4 p-6 bg-primary-50 rounded-lg border border-primary-200">
                <p className="text-gray-800 font-medium mb-2">Data Protection Inquiries</p>
                <p className="text-gray-700">
                  Email:{' '}
                  <a href="mailto:campuscuthelp@gmail.com" className="text-primary-500 hover:underline">
                    campuscuthelp@gmail.com
                  </a>
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  Subject line: GDPR Request - [Your Request Type]
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
            Terms of Service
          </Link>
          <Link 
            to="/privacy" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Privacy Policy
          </Link>
          <Link 
            to="/help" 
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            Help Center
          </Link>
        </div>
      </div>
    </div>
  );
}

