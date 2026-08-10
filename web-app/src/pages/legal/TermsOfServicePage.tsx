import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import webpageLogo from '../../assets/logos/Webpage_Logo copy.png';

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  const lastUpdated = 'August 10, 2026';

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
            <img src={webpageLogo} alt="OnCuts" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">OnCuts</span>
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
                Welcome to OnCuts (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). These Terms of Service
                (&quot;Terms&quot;) govern your access to and use of the OnCuts platform, including our website,
                the OnCuts iOS apps for consumers and operators, and all related services (collectively, the
                &quot;Service&quot;).
              </p>
              <p className="mt-3">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may
                not access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
              <p>
                OnCuts is a marketplace platform that connects people seeking grooming and related personal services
                (&quot;Consumers&quot;) with independent service providers (&quot;Operators,&quot; also referred to as
                barbers or beauty providers where applicable). We facilitate:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Discovery and browsing of operator profiles, services, portfolios, and service locations</li>
                <li>Booking and scheduling of appointments on iOS and the web</li>
                <li>In-app and web messaging between Consumers and Operators</li>
                <li>Secure payment processing when an Operator accepts a booking, plus optional tips after completion</li>
                <li>Reviews and ratings</li>
                <li>Operator applications, onboarding, and platform administration</li>
              </ul>
              <p className="mt-3">
                <strong>Important:</strong> OnCuts is a platform that connects users. We are not a grooming service
                provider. Operators are independent contractors, not employees of OnCuts.
              </p>
              <p className="mt-3">
                Consumers may use the OnCuts iOS app or our website. Operators manage bookings, availability,
                messaging, profile visibility, and payouts through the operator experience on iOS and/or the web
                dashboard, where available.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Account Registration</h2>
              <p>
                <strong>Account creation:</strong> When you register with email and password, you must verify your
                email with the code we send you and accept these Terms. Submitting the registration form or receiving
                a verification email alone does not create an account. A user account is created after successful
                verification. If you did not provide a first or last name at signup, we may set your display name from
                your email address.
              </p>
              <p className="mt-3">
                Where supported, you may also sign in with Apple or Google, or complete phone-based one-time password
                (OTP) authentication. If you use a third-party sign-in or OTP provider, you authorize us to receive the
                identity information that provider shares with us (such as an identity token, email, name, or phone
                number).
              </p>
              <p className="mt-3">To use certain features of the Service, you must create an account. You agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password, devices, and account</li>
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
                <li>Provide accurate booking information including preferred date, time, and meeting details</li>
                <li>Arrive on time for scheduled appointments</li>
                <li>Cancel or update appointments according to the cancellation and reschedule rules below</li>
                <li>Treat Operators with respect and professionalism</li>
                <li>
                  Pay the agreed service price after the Operator accepts your booking, and pay any tip you choose after
                  the service is marked complete
                </li>
                <li>Leave honest and fair reviews based on actual experiences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Operator Terms</h2>
              <p>As an Operator using the Service, you agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Submit an application and receive approval from OnCuts administrators before offering services</li>
                <li>Maintain accurate and up-to-date profile information, including services, pricing, and availability</li>
                <li>
                  Maintain a public service location (such as a map pin or service area) when required for discovery,
                  and understand that hiding your profile removes you from consumer discovery while you remain an
                  Operator
                </li>
                <li>Respond to booking requests in a timely manner</li>
                <li>Honor confirmed bookings and arrive on time</li>
                <li>Provide professional, quality services</li>
                <li>Comply with all applicable laws, regulations, and licensing requirements</li>
                <li>Maintain appropriate insurance coverage as required by law</li>
                <li>Treat Consumers with respect and professionalism</li>
                <li>Connect a valid Stripe Express account with payouts enabled so Consumers can book and pay you</li>
              </ul>
              <p className="mt-3">
                Operators are independent contractors and are solely responsible for their services, business practices,
                tax obligations, and compliance with applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Payments and Fees</h2>

              <p className="font-semibold mt-4 mb-2">6.1 Payment Processing</p>
              <p>
                All card and wallet payments are processed securely through Stripe, our third-party payment processor.
                By using the Service, you agree to Stripe&apos;s terms of service. We do not store your full credit card
                information on our servers. Supported payment methods may include card, Apple Pay, and Google Pay.
              </p>

              <p className="font-semibold mt-4 mb-2">6.2 When Consumers Pay</p>
              <p>
                Consumers pay the service amount after an Operator accepts the booking. Payment is completed in the
                OnCuts app or on the web. After the Operator marks the service complete, the Consumer may add an
                optional tip (preset amounts or a custom amount, where offered).
              </p>

              <p className="font-semibold mt-4 mb-2">6.3 Platform Fee and Operator Payouts</p>
              <p>
                OnCuts charges a platform fee on eligible card service payments. The fee percentage is set by OnCuts
                (default 15%) and may change. Operators receive the service amount minus any applicable platform fee.
                Tips are passed to the Operator in full and do not include a platform fee.
              </p>
              <p className="mt-3">
                OnCuts may grant Operators commission-free bookings (for example, a default allotment for new Operators,
                or a time-limited commission-free window). During those bookings, a platform-funded kickback may also
                apply when configured. OnCuts may enable or disable platform commission globally. Fee, commission-free,
                and kickback details shown in the operator dashboard or booking flow control the applicable amount for
                a given booking.
              </p>
              <p className="mt-3">
                Payout timing depends on Stripe Connect (including Express schedules and any Instant payout options) and
                banking policies. New Stripe accounts may wait several business days after the first live card payment
                before the first bank payout.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cancellations, Reschedules, and Refunds</h2>
              <p>
                Before a service is marked complete, Consumers may update time, date, meeting details, or notes. The
                Operator is notified of those changes. Consumers may cancel anytime before completion.
              </p>
              <p className="mt-3">
                If a Consumer cancels a paid booking within one (1) hour of the appointment start time, the service
                payment is non-refundable. If the Operator cancels a paid booking, the Consumer receives a full refund
                of the service payment, subject to Stripe and banking processing times.
              </p>
              <p className="mt-3">
                Refund eligibility outside those rules depends on timing, the reason for cancellation, whether the
                service was partially or fully rendered, and payment processor rules. Disputes between Consumers and
                Operators should first be resolved directly. OnCuts may assist in mediation but is not obligated to
                issue refunds beyond what these Terms and applicable law require.
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
                The Service and its original content, features, and functionality are owned by OnCuts and are
                protected by international copyright, trademark, patent, trade secret, and other intellectual property
                laws.
              </p>
              <p className="mt-3">
                By posting User Content, you grant OnCuts a non-exclusive, worldwide, royalty-free license to use,
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
                WE DO NOT ENDORSE, WARRANT, OR GUARANTEE ANY OPERATOR&apos;S SERVICES, QUALIFICATIONS, OR WORK QUALITY.
                YOU USE THE SERVICE AND ENGAGE WITH OPERATORS AT YOUR OWN RISK.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">12. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONCUTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
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
                You agree to indemnify, defend, and hold harmless OnCuts and its officers, directors, employees,
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
              <p className="mt-2">Email: oncutshelp@gmail.com</p>
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
