import { Directory } from "@dagger.io/dagger"

export async function calVer(root: Directory, buildNumber: number = 0): Promise<string> {
  const head = root.asGit().head()
  const sha = await head.commit()
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error(`Expected git SHA, got: ${sha}`)
  }

  const branchRef = await head.ref()
  const branchName = branchRef.replace(/^refs\/heads\//, "")
  const safeBranchName = branchName.replace(/[^a-zA-Z0-9._-]/g, "")
  const shortSafeBranchName = safeBranchName.length > 20
    ? safeBranchName.slice(0, 20)
    : safeBranchName
  const now = new Date()
  const year = String(now.getUTCFullYear()).padStart(4, "0")
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate() + 1).padStart(2, "0")
  const shortSha = sha.slice(0, 10)
  const calVerValue = `${year}.${month}.${day}`

  return `${calVerValue}+branch.${shortSafeBranchName}.build.${buildNumber}.sha.${shortSha}`
}
