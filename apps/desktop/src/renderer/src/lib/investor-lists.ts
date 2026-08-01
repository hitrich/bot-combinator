import type { InvestorSummary } from '../../../shared/contracts';

export type RecommendedListKind = 'high_fit' | 'check_size_review' | 'nyc_seed';

const MAX_RECOMMENDED_MEMBERS = 50;

function byFitThenName(left: InvestorSummary, right: InvestorSummary): number {
  return right.fitScore - left.fitScore || left.name.localeCompare(right.name);
}

export function filterInvestorsByMemberIds(
  investors: InvestorSummary[],
  memberFirmIds: string[],
): InvestorSummary[] {
  const members = new Set(memberFirmIds);
  return investors.filter((investor) => members.has(investor.id));
}

export function recommendedMemberFirmIds(
  kind: RecommendedListKind,
  investors: InvestorSummary[],
): string[] {
  return [...investors]
    .filter((investor) => {
      if (kind === 'high_fit') return investor.fitScore >= 70;
      if (kind === 'check_size_review') {
        return (
          investor.confidence === 'stale' ||
          investor.confidence === 'unknown' ||
          (investor.check.minimum === null && investor.check.maximum === null)
        );
      }
      const locationEvidence = [investor.headquarters, ...investor.geographies]
        .filter((value): value is string => Boolean(value))
        .join(' ');
      return (
        /new york|nyc|brooklyn/iu.test(locationEvidence) &&
        investor.stages.some((stage) => /(?:pre[-_ ]?)?seed/iu.test(stage))
      );
    })
    .sort(byFitThenName)
    .slice(0, MAX_RECOMMENDED_MEMBERS)
    .map((investor) => investor.id);
}
