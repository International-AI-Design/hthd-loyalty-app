import { AppShell } from '../components/AppShell';
import { BadgeGrid } from '../components/BadgeGrid';
import { NextBadgeProgress } from '../components/NextBadgeProgress';

export function BadgesPage() {
  return (
    <AppShell>
      <div className="px-4 pt-4 pb-8 space-y-5 font-body">
        <section>
          <h1 className="font-heading text-2xl font-bold text-brand-forest mb-1">
            My Badges
          </h1>
          <p className="text-sm text-brand-forest-muted mb-4">
            Earn badges by visiting, referring friends, and keeping your pups healthy.
          </p>
        </section>

        <section>
          <NextBadgeProgress />
        </section>

        <section>
          <BadgeGrid />
        </section>
      </div>
    </AppShell>
  );
}
