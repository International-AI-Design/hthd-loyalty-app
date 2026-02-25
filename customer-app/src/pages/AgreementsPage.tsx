import { useState, useEffect, useCallback } from 'react';
import { agreementApi } from '../lib/api';
import { BottomNav } from '../components/BottomNav';
import { AgreementViewer } from '../components/AgreementViewer';
import { Button, Alert } from '../components/ui';
import type { ServiceAgreement, AgreementSignature } from '../lib/api';

export function AgreementsPage() {
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([]);
  const [signatures, setSignatures] = useState<AgreementSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [agrRes, sigRes] = await Promise.all([
      agreementApi.getRequired('all'),
      agreementApi.getMySignatures(),
    ]);

    // Fall back to all active agreements if 'all' returns empty
    let agrList = agrRes.data?.agreements ?? [];
    if (agrList.length === 0) {
      const allRes = await agreementApi.getAll();
      agrList = allRes.data?.agreements ?? [];
    }

    if (agrRes.error && sigRes.error) {
      setError('Unable to load agreements. Please try again.');
    } else {
      setAgreements(agrList);
      setSignatures(sigRes.data?.signatures ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const signedIds = new Set(signatures.map((s) => s.agreementId));
  const unsigned = agreements.filter((a) => !signedIds.has(a.id));
  const signed = agreements.filter((a) => signedIds.has(a.id));

  async function handleSign(agreementId: string, typedName: string) {
    setSigningId(agreementId);
    const res = await agreementApi.sign(agreementId, typedName);
    setSigningId(null);

    if (res.error) {
      setError(res.error);
    } else {
      // Refresh to get updated list
      loadData();
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-24">
      {/* Header */}
      <div className="bg-white border-b border-brand-sand/50">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="font-heading text-2xl font-bold text-brand-forest">
            Agreements
          </h1>
          <p className="text-sm text-brand-forest-muted mt-1">
            Review and sign service agreements
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {error && (
          <Alert variant="error">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadData} className="mt-2">
              Retry
            </Button>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-brand-forest-muted">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-body">Loading agreements...</span>
            </div>
          </div>
        ) : agreements.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-brand-primary/40 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-body text-brand-forest-muted">
              No agreements to sign right now.
            </p>
          </div>
        ) : (
          <>
            {/* Unsigned agreements */}
            {unsigned.length > 0 && (
              <section>
                <h2 className="text-sm font-body font-semibold text-brand-forest-light uppercase tracking-wider mb-3">
                  Pending Signatures ({unsigned.length})
                </h2>
                <div className="space-y-3">
                  {unsigned.map((agreement) => (
                    <AgreementViewer
                      key={agreement.id}
                      agreement={agreement}
                      onSign={(typedName) => handleSign(agreement.id, typedName)}
                      alreadySigned={false}
                      signing={signingId === agreement.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Signed agreements */}
            {signed.length > 0 && (
              <section>
                <h2 className="text-sm font-body font-semibold text-brand-forest-light uppercase tracking-wider mb-3">
                  Signed ({signed.length})
                </h2>
                <div className="space-y-3">
                  {signed.map((agreement) => (
                    <AgreementViewer
                      key={agreement.id}
                      agreement={agreement}
                      onSign={() => {}}
                      alreadySigned={true}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
