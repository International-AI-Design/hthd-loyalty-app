import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agreementApi, dogProfileApi } from '../lib/api';
import { Button, Alert } from './ui';
import type { ServiceAgreement } from '../lib/api';

interface EligibilityCheckerProps {
  serviceType: string;
  dogIds: string[];
  onEligible: () => void;
}

interface VaxIssue {
  dogId: string;
  dogName: string;
  issues: string[];
}

export function EligibilityChecker({ serviceType, dogIds, onEligible }: EligibilityCheckerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingAgreements, setMissingAgreements] = useState<ServiceAgreement[]>([]);
  const [vaxIssues, setVaxIssues] = useState<VaxIssue[]>([]);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, [serviceType, dogIds.join(',')]);

  async function checkEligibility() {
    setLoading(true);
    setError(null);

    try {
      // Check agreement compliance
      const complianceRes = await agreementApi.checkCompliance(serviceType);
      const missingAgr = complianceRes.data?.missing ?? [];
      setMissingAgreements(missingAgr);

      // Check vaccination compliance for each dog
      const dogVaxIssues: VaxIssue[] = [];
      for (const dogId of dogIds) {
        const compRes = await dogProfileApi.getCompliance(dogId);
        if (compRes.data && !compRes.data.isFullyCompliant) {
          const dogRes = await dogProfileApi.getDog(dogId);
          const dogName = dogRes.data?.dog?.name ?? 'Your dog';
          const issues = compRes.data.compliance
            .filter((c) => c.status !== 'compliant')
            .map((c) => `${c.requirement}: ${c.status}`);
          if (issues.length > 0) {
            dogVaxIssues.push({ dogId, dogName, issues });
          }
        }
      }
      setVaxIssues(dogVaxIssues);

      const isEligible = missingAgr.length === 0 && dogVaxIssues.length === 0;
      setEligible(isEligible);
      if (isEligible) {
        onEligible();
      }
    } catch {
      setError('Unable to check eligibility. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-brand-forest-muted">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-body">Checking eligibility...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={checkEligibility} className="mt-2">
          Retry
        </Button>
      </Alert>
    );
  }

  if (eligible) {
    return (
      <div className="bg-brand-success/10 border border-brand-success/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-body text-brand-forest font-medium">
            All requirements met — you're ready to book!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-semibold text-brand-forest">
        Before you can book
      </h3>

      {/* Agreement issues */}
      {missingAgreements.length > 0 && (
        <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-amber-dark flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-body font-medium text-brand-forest">
              Agreements needed ({missingAgreements.length})
            </p>
          </div>
          <ul className="text-sm text-brand-forest-light space-y-1 ml-7">
            {missingAgreements.map((a) => (
              <li key={a.id}>{a.displayName}</li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="ml-7"
            onClick={() => navigate('/agreements')}
          >
            Sign agreements
          </Button>
        </div>
      )}

      {/* Vaccination issues */}
      {vaxIssues.length > 0 && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
            <p className="text-sm font-body font-medium text-brand-forest">
              Vaccination records needed
            </p>
          </div>
          {vaxIssues.map((dog) => (
            <div key={dog.dogId} className="ml-7">
              <p className="text-sm font-medium text-brand-forest">{dog.dogName}:</p>
              <ul className="text-sm text-brand-forest-light space-y-0.5">
                {dog.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/dogs/${dog.dogId}`)}
                className="mt-1"
              >
                Update vaccinations
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
