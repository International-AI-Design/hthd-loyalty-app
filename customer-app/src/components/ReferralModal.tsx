import { QRCodeSVG } from 'qrcode.react';
import { Modal, Button } from './ui';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
  referralCount: number;
  bonusPoints: number;
  onShare: () => void;
}

export function ReferralModal({
  isOpen,
  onClose,
  referralCode,
  referralCount,
  bonusPoints,
  onShare,
}: ReferralModalProps) {
  const referralUrl = `${window.location.origin}/register?ref=${referralCode}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share & Earn">
      <div className="space-y-6">
        {/* QR Code */}
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl border-2 border-brand-blue/20 shadow-sm">
            <QRCodeSVG
              value={referralUrl}
              size={180}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#1e3a5f"
            />
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">
            Scan to sign up with your referral
          </p>
        </div>

        {/* Referral Code Display */}
        <div className="bg-brand-warm-white rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Your referral code</p>
          <p className="text-3xl font-mono font-bold text-brand-navy tracking-wider">
            {referralCode}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-cream rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-navy">{referralCount}</p>
            <p className="text-xs text-gray-600">
              {referralCount === 1 ? 'friend referred' : 'friends referred'}
            </p>
          </div>
          <div className="bg-brand-cream rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-blue">+{bonusPoints.toLocaleString()}</p>
            <p className="text-xs text-gray-600">bonus points</p>
          </div>
        </div>

        {/* Share Button */}
        <Button onClick={onShare} className="w-full" size="lg">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share with Friends
        </Button>

        {/* Incentive reminder */}
        <p className="text-center text-sm text-gray-500">
          You earn <span className="font-semibold text-brand-blue">100 points</span> for each friend who joins!
        </p>
      </div>
    </Modal>
  );
}
