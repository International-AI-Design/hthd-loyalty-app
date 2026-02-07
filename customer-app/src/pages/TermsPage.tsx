import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-warm-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-brand-navy font-heading text-center mb-2">
            Terms &amp; Conditions
          </h1>
          <p className="text-center text-gray-500 text-sm mb-8">
            Effective Date: February 2026
          </p>

          {/* 1. Acceptance of Terms */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            By creating an account with Happy Tail Happy Dog (&quot;HTHD,&quot; &quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;), a pet care facility in Denver, CO operated by Ferro
            Consulting LLC (dba International AI Design), you agree to be bound by these Terms &amp;
            Conditions. If you do not agree to these terms, please do not create an account or use
            our services. Your continued use of the HTHD platform constitutes your ongoing acceptance
            of these terms.
          </p>

          {/* 2. Services Description */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            2. Services Description
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Happy Tail Happy Dog provides pet care services including daycare, boarding, and
            grooming. Through our online platform you can:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>Book and manage appointments for daycare, boarding, and grooming</li>
            <li>Earn and redeem loyalty rewards points</li>
            <li>Maintain a prepaid wallet balance for convenient checkout</li>
            <li>Receive booking confirmations, reminders, and support via SMS</li>
            <li>Manage your pet profiles and vaccination records</li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Service availability, pricing, and hours of operation are subject to change. We will make
            reasonable efforts to notify you of significant changes.
          </p>

          {/* 3. Account Responsibilities */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            3. Account Responsibilities
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            When you create an account, you agree to:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>
              Provide accurate, current, and complete information about yourself and your pets
            </li>
            <li>
              Keep your login credentials secure and confidential &mdash; you are responsible for all
              activity that occurs under your account
            </li>
            <li>
              Maintain only one account per person &mdash; duplicate accounts may be merged or
              deactivated
            </li>
            <li>
              Promptly update your account information if anything changes (contact details,
              pet health records, vaccination status)
            </li>
            <li>Notify us immediately if you suspect unauthorized use of your account</li>
          </ul>

          {/* 4. Booking & Cancellation Policy */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            4. Booking &amp; Cancellation Policy
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            All bookings are subject to the following policies:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>
              <strong>Cancellations:</strong> Bookings must be cancelled at least 24 hours in advance.
              Late cancellations or no-shows may be subject to a fee.
            </li>
            <li>
              <strong>Late Pickup Fees:</strong> A fee of $15 per 30-minute increment applies for
              late pickups beyond the scheduled time. Please plan accordingly or contact us if you are
              running late.
            </li>
            <li>
              <strong>Vaccination Requirements:</strong> All pets must have current vaccinations on
              file before receiving services. Required vaccinations include rabies, DHPP
              (distemper/parvo), and bordetella. Pets without current vaccination records may be turned
              away at check-in.
            </li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We reserve the right to refuse service to any pet that exhibits aggressive behavior, shows
            signs of illness, or does not meet our health and safety requirements.
          </p>

          {/* 5. Loyalty Program */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            5. Loyalty Program
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Our loyalty program allows you to earn and redeem points as follows:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>
              <strong>Earning Points:</strong> Earn 1 point for every $1 spent on services. Grooming
              services earn at a 1.5x rate (1.5 points per $1 spent).
            </li>
            <li>
              <strong>Points Cap:</strong> A maximum of 500 points may be accumulated in your account
              at any time.
            </li>
            <li>
              <strong>Redemption Tiers:</strong> Points may be redeemed at the following levels:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>100 points &mdash; small reward</li>
                <li>250 points &mdash; medium reward</li>
                <li>500 points &mdash; large reward</li>
              </ul>
            </li>
            <li>
              <strong>No Cash Value:</strong> Points have no cash value and cannot be exchanged for
              money, transferred to another account, or sold.
            </li>
            <li>
              <strong>Program Changes:</strong> We reserve the right to modify, suspend, or
              discontinue the loyalty program at any time with reasonable notice. Earned points will be
              honored for a period of 30 days following any program termination.
            </li>
          </ul>

          {/* 6. Wallet */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            6. Wallet
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            The HTHD Wallet allows you to maintain a prepaid balance for quick and convenient
            checkout. Please note the following:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>
              Wallet funds are prepaid and applied to future services at checkout
            </li>
            <li>
              Wallet balances are non-transferable and may only be used by the account holder
            </li>
            <li>
              Refunds of wallet balances are available upon request &mdash; contact us at{' '}
              <a
                href="mailto:support@happytailhappydog.com"
                className="text-brand-blue hover:text-brand-blue-dark font-medium"
              >
                support@happytailhappydog.com
              </a>{' '}
              to request a refund
            </li>
            <li>
              Wallet balances do not earn interest
            </li>
          </ul>

          {/* 7. SMS Messaging Program */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            7. SMS Messaging Program
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Program Name:</strong> Happy Tail Happy Dog SMS
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Program Description:</strong> By providing your phone number and consenting to
            receive SMS messages, you are enrolling in the Happy Tail Happy Dog SMS program. This
            program provides booking confirmations, appointment reminders, and AI-powered customer
            support to help you manage your pet care services.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Message Frequency:</strong> Message frequency varies based on your bookings and
            interactions with our services. Expect approximately 2&ndash;10 messages per month.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Message &amp; Data Rates:</strong> Message and data rates may apply. Check with
            your wireless carrier for details about your messaging plan.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Opt-Out:</strong> You may opt out of SMS messages at any time. Text{' '}
            <strong className="text-brand-navy">STOP</strong> to the number from which you receive
            messages to immediately stop all future SMS communications. You will receive a one-time
            confirmation message after opting out. Opting out of SMS will not affect your account or
            ability to use other HTHD services.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Help:</strong> For support, text{' '}
            <strong className="text-brand-navy">HELP</strong> to the number from which you receive
            messages, or email us at{' '}
            <a
              href="mailto:support@happytailhappydog.com"
              className="text-brand-blue hover:text-brand-blue-dark font-medium"
            >
              support@happytailhappydog.com
            </a>
            .
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            <strong>Supported Carriers:</strong> Major US carriers are supported, including AT&amp;T,
            Verizon, T-Mobile, Sprint, and others. Carriers are not liable for delayed or
            undelivered messages.
          </p>

          {/* 8. Acceptable Use */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            8. Acceptable Use
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            By using our platform, you agree not to:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-4 text-sm space-y-1 pl-2">
            <li>
              Abuse, harass, or threaten our staff, other customers, or their pets
            </li>
            <li>
              Use automated bots, scrapers, or other tools to access or interact with our platform
            </li>
            <li>
              Attempt to gain unauthorized access to our systems, other user accounts, or data
            </li>
            <li>
              Use the platform for any unlawful or fraudulent purpose
            </li>
            <li>
              Interfere with the proper functioning of the platform or its infrastructure
            </li>
            <li>
              Treat staff or other customers with disrespect &mdash; we maintain a positive
              environment for people and pets alike
            </li>
          </ul>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We reserve the right to suspend or terminate accounts that violate these guidelines.
          </p>

          {/* 9. Limitation of Liability */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            9. Limitation of Liability
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            To the fullest extent permitted by law, Happy Tail Happy Dog, Ferro Consulting LLC, and
            their officers, employees, and agents shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising from your use of our services or
            platform, including but not limited to loss of data, loss of revenue, or interruption of
            service.
          </p>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Our total liability to you for any claim arising from these terms or your use of our
            services shall not exceed the amount you paid to HTHD in the 12 months preceding the
            claim. We provide our platform and services &quot;as is&quot; and make no warranties,
            express or implied, regarding their availability, accuracy, or fitness for a particular
            purpose.
          </p>

          {/* 10. Governing Law */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            10. Governing Law
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            These Terms &amp; Conditions shall be governed by and construed in accordance with the
            laws of the State of Colorado, without regard to its conflict of law provisions. Any
            disputes arising under these terms shall be resolved in the courts located in Denver
            County, Colorado.
          </p>

          {/* 11. Changes to Terms */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            11. Changes to Terms
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            We may update these Terms &amp; Conditions from time to time. When we make changes, we
            will notify you by email or through a notice in the app and update the effective date at
            the top of this page. Your continued use of our services after changes take effect
            constitutes your acceptance of the updated terms. We encourage you to review these terms
            periodically.
          </p>

          {/* 12. Contact */}
          <h2 className="text-xl font-bold text-brand-navy mt-6 mb-2 font-heading">
            12. Contact
          </h2>
          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
            Questions or concerns about these terms? We&apos;re here to help.
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
