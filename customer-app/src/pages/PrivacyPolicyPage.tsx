import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-brand-warm-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-brand-navy font-heading text-center mb-2">
            Privacy Policy
          </h1>
          <p className="text-center text-gray-500 text-sm mb-8">
            Effective Date: February 2026
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Happy Tail Happy Dog (&quot;HTHD,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a pet care
            facility in Denver, CO operated by Ferro Consulting LLC (dba International AI Design).
            We care about your privacy just as much as we care about your pets. This policy explains
            what information we collect, how we use it, and what choices you have.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Information We Collect
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            When you create an account, book services, or interact with us, we may collect:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Your name, email address, and phone number</li>
            <li>Your pet&apos;s information (name, breed, age, health notes, vaccination records)</li>
            <li>Booking and appointment history</li>
            <li>Payment information (processed securely through our payment provider &mdash; we do not store full card numbers)</li>
            <li>Loyalty program activity and points balance</li>
            <li>Communications you send us, including SMS messages</li>
          </ul>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            How We Use Your Information
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Provide and manage our pet care services</li>
            <li>Send booking confirmations and appointment reminders</li>
            <li>Operate our loyalty rewards program</li>
            <li>Provide AI-powered customer support via SMS (our concierge can help with bookings, answer questions, and send reminders)</li>
            <li>Communicate with you about your account or services</li>
            <li>Improve our services and customer experience</li>
          </ul>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            SMS Communications
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            When you provide your phone number, you may receive SMS messages from us including:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Appointment confirmations and reminders</li>
            <li>Responses from our AI-powered concierge when you text us</li>
            <li>Loyalty program updates (points earned, rewards available)</li>
            <li>Important service notifications (schedule changes, closures)</li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            These are transactional and service-related messages, not marketing. You can opt out of
            non-essential messages at any time by replying STOP or contacting us. Standard message
            and data rates may apply.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Data Sharing
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We do <strong>not</strong> sell, rent, or share your personal information with third
            parties for their marketing purposes. Period.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We may share limited information with trusted service providers who help us operate our
            business, including:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Twilio &mdash; for SMS message delivery</li>
            <li>Payment processors &mdash; to securely handle transactions</li>
            <li>Cloud hosting providers &mdash; to store and serve your account data</li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            These providers only access your information as needed to perform their services and are
            contractually obligated to keep it secure.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We may also disclose information if required by law or to protect the safety of our
            customers, pets, or staff.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Data Security
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We take reasonable measures to protect your information, including:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Secure database storage with access controls</li>
            <li>Password hashing &mdash; we never store your password in plain text</li>
            <li>Regular review of our security practices</li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            No system is 100% secure, but we work hard to protect your data and will notify you
            promptly if a breach ever affects your information.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Data Retention
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We keep your information for as long as your account is active and as needed to provide
            you services. If you&apos;d like to close your account and have your data deleted, just
            let us know &mdash; we&apos;ll take care of it. We may retain certain records as required
            by law (for example, transaction records for tax purposes).
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Your Rights
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li><strong>Access</strong> the personal information we have about you</li>
            <li><strong>Correct</strong> any inaccurate information</li>
            <li><strong>Delete</strong> your account and personal data</li>
            <li><strong>Opt out</strong> of non-essential SMS communications</li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            To exercise any of these rights, email us at{' '}
            <a
              href="mailto:support@happytailhappydog.com"
              className="text-brand-blue hover:text-brand-blue-dark font-medium"
            >
              support@happytailhappydog.com
            </a>
            . We&apos;ll respond within 30 days.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Children&apos;s Privacy
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Our services are not directed to children under 13, and we do not knowingly collect
            personal information from anyone under 13. If you believe a child has provided us with
            personal information, please contact us and we will promptly delete it.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Changes to This Policy
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We may update this privacy policy from time to time. If we make meaningful changes,
            we&apos;ll notify you by email or through a notice in the app. Your continued use of our
            services after changes take effect means you accept the updated policy.
          </p>

          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            Contact Us
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Questions about this policy or your data? We&apos;re happy to help.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Happy Tail Happy Dog</strong>
            <br />
            Operated by Ferro Consulting LLC (dba International AI Design)
            <br />
            Denver, CO
            <br />
            Email:{' '}
            <a
              href="mailto:support@happytailhappydog.com"
              className="text-brand-blue hover:text-brand-blue-dark font-medium"
            >
              support@happytailhappydog.com
            </a>
          </p>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <Link
              to="/login"
              className="text-brand-blue hover:text-brand-blue-dark font-medium text-sm"
            >
              &larr; Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
