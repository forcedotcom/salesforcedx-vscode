'use strict'

/**
 * pre-changelog-generation hook for TriPSs/conventional-changelog-action.
 * When RELEASE_TYPE env var is set (from workflow_dispatch input), override
 * the version bump type instead of relying solely on conventional commits.
 */
exports.preVersionGeneration = (proposedVersion) => {
  const releaseType = process.env.RELEASE_TYPE
  if (!releaseType || !['major', 'minor', 'patch'].includes(releaseType)) {
    return proposedVersion
  }
  const { version } = require('../packages/soql-common/package.json')
  const [major, minor, patch] = version.split('.').map(Number)
  if (releaseType === 'major') return `${major + 1}.0.0`
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
