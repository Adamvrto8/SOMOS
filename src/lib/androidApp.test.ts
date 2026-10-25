import { describe, expect, it } from 'vitest'
import twaJson from '../../android/twa-manifest.json'
import linksJson from '../../public/.well-known/assetlinks.json'

// The Google Play app (android/twa-manifest.json, docs/google-play-setup.md) opens the site full screen only
// while public/.well-known/assetlinks.json names the same package and the same signing keys.

interface TwaManifest {
  packageId: string
  host: string
  fingerprints: { name: string; value: string }[]
}
interface AssetStatement {
  relation: string[]
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] }
}

const twa: TwaManifest = twaJson
const links: AssetStatement[] = linksJson

describe('Android app links', () => {
  it('has one statement for the package of the app', () => {
    expect(links).toHaveLength(1)
    expect(links[0].relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(links[0].target.namespace).toBe('android_app')
    expect(links[0].target.package_name).toBe(twa.packageId)
  })

  it('lists the same signing keys as the app', () => {
    const fingerprints = links[0].target.sha256_cert_fingerprints
    expect([...fingerprints].sort()).toEqual(twa.fingerprints.map((f) => f.value).sort())
    for (const fingerprint of fingerprints) expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  })

  it('opens the production site', () => {
    expect(twa.host).toBe('somos-jade.vercel.app')
  })
})
