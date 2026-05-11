import PageMeta from '../../components/common/PageMeta'
import JobMatchingCandidates from '../../components/tables/JobMatchingCandidates'

export default function MatchedCandidate() {
  return (
  <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      {/* <PageBreadcrumb pageTitle="Schedulers" /> */}
      <div className="space-y-6">
          <JobMatchingCandidates />
      </div>
    </>  )
}
