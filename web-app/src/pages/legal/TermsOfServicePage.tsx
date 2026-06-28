import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import webpageLogo from '../../assets/logos/Webpage_Logo copy.png';

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                Welcome to PismoPlatforms (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). These Terms of Service
                (&quot;Terms&quot;) govern your access to and use of the PismoPlatforms platform, including our website,
                the PismoPlatforms iOS app for consumers, the Pismo - Provider iOS app for barbers, and all related services
                (collectively, the &quot;Service&quot;).
              </p>
              <p className="mt-3">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may
                not access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
              <p>
                PismoPlatforms is a marketplace platform that connects consumers seeking grooming services
                (&quot;Consumers&quot;) with independent barbers (&quot;Barbers&quot;) at college and university
                campuses. We facilitate:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Discovery and browsing of barber profiles, services, and portfolios</li>
                <li>Booking and scheduling of appointments on iOS and the web</li>
                <li>In-app and web messaging between Consumers and Barbers</li>
                <li>Secure payment processing after services are completed</li>
                <li>Reviews and ratings</li>
                <li>Barber application review and platform administration</li>
              </ul>
              <p className="mt-3">
                <strong>Important:</strong> PismoPlatforms is a platform that connects users. We are not a grooming service
                provider. Barbers are independent contractors, not employees of PismoPlatforms.
              </p>
              <p className="mt-3">
                Consumers may use the PismoPlatforms iOS app or our website. Barbers manage bookings, availability,
                messaging, and payouts through the Pismo - Provider iOS app and/or the barber web dashboard, where
                available.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Account Registration</h2>
              <p>
                <strong>Account creation:</strong> On our verification page you must enter the same email and password
                you used to sign up, accept these Terms of Service, and then enter the verification code we email you.
                If you did not provide a first or last name at signup, we may set your display name from your email
                address. A user account is created after you successfully verify with your code. Submitting the
                registration form or receiving a verification email alone does not create an account.
              </p>
              <p className="mt-3">
                You may also sign in with Apple where supported. If you use Sign in with Apple, you authorize us to
                receive the information Apple provides (such as your Apple ID token, email, or name on first sign-in).
              </p>
              <p className="mt-3">To use certain features of the Service, you must create an account. You agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
              <p className="mt-3">
                You must be at least 18 years old to create an account. By creating an account, you represent and
                warrant that you meet this age requirement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Consumer Terms</h2>
              <p>As a Consumer using the Service, you agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide accurate booking information including preferred date, time, and location</li>
                <li>Arrive on time for scheduled appointments</li>
                <li>Cancel or reschedule appointments with reasonable notice</li>
                <li>Treat Barbers with respect and professionalism</li>
                <li>Pay the agreed-upon price for services rendered after the service is marked complete</li>
                <li>Leave honest and fair reviews based on actual experiences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Barber Terms</h2>
              <p>As a Barber using the Service, you agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Submit an application and receive approval from PismoPlatforms administrators before offering services</li>
                <li>Maintain accurate and up-to-date profile information, including services and pricing</li>
                <li>Respond to booking requests in a timely manner</li>
                <li>Honor confirmed bookings and arrive on time</li>
                <li>Provide professional, quality services</li>
                <li>Comply with all applicable laws, regulations, and licensing requirements</li>
                <li>Maintain appropriate insurance coverage as required by law</li>
                <li>Treat Consumers with respect and professionalism</li>
                <li>Connect a valid Stripe account to receive payouts</li>
              </ul>
              <p className="mt-3">
                Barbers are independent contractors and are solely responsible for their services, business practices,
                tax obligations, and compliance with applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Payments and Fees</h2>

              <p className="font-semibold mt-4 mb-2">6.1 Payment Processing</p>
              <p>
                All payments are processed securely through Stripe, our third-party payment processor. By using the
                Service, you agree to Stripe&apos;s terms of service. We do not store your full credit card information
                on our servers. Supported payment methods may include card, Apple Pay, and Google Pay.
              </p>

              <p className="font-semibold mt-4 mb-2">6.2 When Consumers Pay</p>
              <p>
                Consumers pay after a haircut is complete. Once the Barber marks the booking as complete, the Consumer
                receives a payment prompt in the PismoPlatforms app or on the web.
              </p>

              <p className="font-semibold mt-4 mb-2">6.3 Platform Fee and Barber Payouts</p>
              <p>
                PismoPlatforms charges a 15% platform fee on the service amount for completed bookings. Barbers receive 85%
                of the service amount. Tips, when added, are passed to the Barber in full. Payout timing may vary based
                on Stripe and banking policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cancellations, Reschedules, and Refunds</h2>
              <p>
                While a booking is pending, Consumers may edit the time, date, location, or notes directly. After a
                Barber accepts, schedule changes require the Barber&apos;s approval through a reschedule request.
                Consumers may cancel before the service is marked complete.
              </p>
              <p className="mt-3">
                Refund eligibility depends on the timing of the cancellation, the reason for cancellation, whether the
                service was partially or fully rendered, and applicable payment processor rules. Disputes between
                Consumers and Barbers should first be resolved directly. PismoPlatforms may assist in mediation but is not
                obligated to issue refunds.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. User Content and Community Standards</h2>
              <p>
                The Service allows users to submit content, including messages, photos, reviews, profile information,
                and portfolio material (&quot;User Content&quot;). You are responsible for your User Content.
              </p>
              <p className="mt-3">You agree not to submit User Content that:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Is unlawful, harassing, abusive, threatening, hateful, or discriminatory</li>
                <li>Is sexually explicit, exploitative, or otherwise inappropriate</li>
                <li>Infringes intellectual property or privacy rights</li>
                <li>Contains spam, scams, or misleading information</li>
              </ul>
              <p className="mt-3">
                We may use automated filters, user reports, and manual review to detect and address violations. We may
                remove content, restrict features, suspend accounts, or permanently ban users who violate these
                standards or applicable law. Users may block other users to prevent further interaction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
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

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">10. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by PismoPlatforms and are
                protected by international copyright, trademark, patent, trade secret, and other intellectual property
                laws.
              </p>
              <p className="mt-3">
                By posting User Content, you grant PismoPlatforms a non-exclusive, worldwide, royalty-free license to use,
                display, and distribute such content in connection with operating and promoting the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">11. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR
                ERROR-FREE.
              </p>
              <p className="mt-3">
                WE DO NOT ENDORSE, WARRANT, OR GUARANTEE ANY BARBER&apos;S SERVICES, QUALIFICATIONS, OR WORK QUALITY.
                YOU USE THE SERVICE AND ENGAGE WITH BARBERS AT YOUR OWN RISK.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">12. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, AVILAPLATFORMS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
                DIRECTLY OR INDIRECTLY.
              </p>
              <p className="mt-3">
                OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNT
                YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">13. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless PismoPlatforms and its officers, directors, employees,
                and agents from any claims, damages, losses, liabilities, and expenses (including attorneys&apos; fees)
                arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">14. Termination</h2>
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior notice or
                liability, for any reason, including if you breach these Terms.
              </p>
              <p className="mt-3">
                Upon termination, your right to use the Service will immediately cease. All provisions of these Terms
                which should survive termination shall survive.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">15. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by
                posting the new Terms on this page and updating the &quot;Last Updated&quot; date.
              </p>
              <p className="mt-3">
                Your continued use of the Service after any changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">16. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of California,
                United States, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">17. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <p className="mt-2">Email: avilaplatformshelp@gmail.com</p>
            </section>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link to="/privacy" className="text-gray-600 hover:text-gray-900">
            Privacy Policy
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
