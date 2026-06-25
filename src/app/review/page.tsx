export const dynamic = 'force-dynamic'

import ReviewClient from './ReviewClient'

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>
}) {
  const { uid } = await searchParams

  return <ReviewClient customerLineUserId={uid ?? null} />
}
