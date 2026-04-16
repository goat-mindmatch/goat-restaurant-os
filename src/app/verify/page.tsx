import VerifyClient from './VerifyClient'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>
}) {
  const { uid } = await searchParams
  return <VerifyClient staffLineUserId={uid ?? null} />
}
