import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectPlatform, formatBytes, getLatestReleaseUrls } from '../github-releases';

// getLatestReleaseUrls uses the global fetch (two URLs: the GitHub API and
// the latest.yml download). Each test stubs fetch and restores afterwards.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});
const textResponse = (text: string, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => text,
});

describe('detectPlatform — UA matrix', () => {
  it('returns "other" for null/undefined/empty UAs', () => {
    expect(detectPlatform(null)).toBe('other');
    expect(detectPlatform(undefined)).toBe('other');
    expect(detectPlatform('')).toBe('other');
  });

  it('detects Android before any desktop hint', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130')).toBe('android');
  });

  it('routes iOS devices to "other" (no iOS build)', () => {
    expect(
      detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15'),
    ).toBe('other');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('other');
    expect(detectPlatform('Mozilla/5.0 (iPod touch)')).toBe('other');
  });

  it('detects Windows', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130'),
    ).toBe('windows');
  });

  it('detects macOS and is case-insensitive', () => {
    expect(detectPlatform('Mozilla/5.0 (Mac OS X 10_15_7) AppleWebKit/605.1.15')).toBe('macos');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; macOS 14)')).toBe('macos');
  });

  it('routes Linux desktops to "other" (no Linux build)', () => {
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Firefox/130')).toBe('other');
  });

  it('falls back to "other" for unrecognized UA text', () => {
    expect(detectPlatform('curl/8.0')).toBe('other');
  });
});

describe('formatBytes — boundaries', () => {
  it('returns "" for zero and negative sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(-5)).toBe('');
  });

  it('formats bytes and kilobytes without decimals', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1023)).toBe('1023 KB');
  });

  it('uses one decimal below 10 MB and none at or above', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 9.5)).toBe('9.5 MB');
    expect(formatBytes(1024 * 1024 * 10)).toBe('10 MB');
    expect(formatBytes(1024 * 1024 * 121)).toBe('121 MB');
  });

  it('formats gigabytes without decimals', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 3 * 2.5)).toBe('3 GB');
  });

  it('caps at the last unit (GB) for absurd sizes', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024 GB');
  });
});

describe('getLatestReleaseUrls — API-asset path', () => {
  it('returns browser_download_url for installer + portable assets', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: 'v0.5.8',
        html_url: 'https://github.com/fotedev/Masar-x-next/releases/tag/v0.5.8',
        assets: [
          {
            name: 'Masar-X-Setup-0.5.8-x64.exe',
            browser_download_url: 'https://github.com/fotedev/Masar-x-next/releases/download/v0.5.8/Masar-X-Setup-0.5.8-x64.exe',
            size: 127926272,
          },
          {
            name: 'Masar-X-Portable-0.5.8-x64.exe',
            browser_download_url: 'https://github.com/fotedev/Masar-x-next/releases/download/v0.5.8/Masar-X-Portable-0.5.8-x64.exe',
            size: 90000000,
          },
        ],
      }),
    );

    const urls = await getLatestReleaseUrls();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/fotedev/Masar-x-next/releases/latest',
      { headers: { Accept: 'application/vnd.github+json' }, next: { revalidate: 3600 } },
    );
    expect(urls.version).toBe('0.5.8');
    expect(urls.windowsInstaller).toContain('Masar-X-Setup-0.5.8-x64.exe');
    expect(urls.windowsPortable).toContain('Masar-X-Portable-0.5.8-x64.exe');
    expect(urls.installerSizeBytes).toBe(127926272);
    expect(urls.portableSizeBytes).toBe(90000000);
    expect(urls.releasesPage).toBe('https://github.com/fotedev/Masar-x-next/releases/tag/v0.5.8');
  });

  it('strips only a leading "v" from the tag and falls back to "latest"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        tag_name: 'latest-tag',
        assets: [
          { name: 'a-Setup-x.exe', browser_download_url: 'https://x/setup', size: 1 },
          { name: 'a-Portable-x.exe', browser_download_url: 'https://x/portable', size: 2 },
        ],
      }),
    );
    expect((await getLatestReleaseUrls()).version).toBe('latest-tag');

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        assets: [
          { name: 'a-Setup-x.exe', browser_download_url: 'https://x/setup', size: 1 },
          { name: 'a-Portable-x.exe', browser_download_url: 'https://x/portable', size: 2 },
        ],
      }),
    );
    expect((await getLatestReleaseUrls()).version).toBe('latest');
  });

  it('falls through to the YAML strategy when assets are missing', async () => {
    // API answers ok but with no usable assets → strategy 2 must run.
    fetchMock.mockResolvedValueOnce(jsonResponse({ tag_name: 'v0.5.9', assets: [] }));
    fetchMock.mockResolvedValueOnce(
      textResponse(
        [
          'version: 0.5.9',
          'path: Masar-X-Setup-0.5.9-x64.exe',
          'sha512: c29tZXNoYQ==',
          'releaseDate: "2026-01-01"',
          '',
          '# a comment line',
          'files:',
          '  - url: Masar-X-Setup-0.5.9-x64.exe',
          '    size: 123456789',
          '  - url: Masar-X-Portable-0.5.9-x64.exe',
          '    size: 87654321',
          '  - url: Masar-X-0.5.9.deb',
          '    size: 1',
        ].join('\n'),
      ),
    );

    const urls = await getLatestReleaseUrls();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urls.version).toBe('0.5.9');
    expect(urls.windowsInstaller).toBe(
      'https://github.com/fotedev/Masar-x-next/releases/latest/download/Masar-X-Setup-0.5.9-x64.exe',
    );
    expect(urls.windowsPortable).toBe(
      'https://github.com/fotedev/Masar-x-next/releases/latest/download/Masar-X-Portable-0.5.9-x64.exe',
    );
    expect(urls.installerSizeBytes).toBe(123456789);
    expect(urls.portableSizeBytes).toBe(87654321);
    // YAML path has no per-release HTML URL → the static releases page.
    expect(urls.releasesPage).toBe('https://github.com/fotedev/Masar-x-next/releases/latest');
  });

  it('constructs the portable name from the version when the files block omits it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ assets: [] }));
    fetchMock.mockResolvedValueOnce(
      textResponse(['version: 1.2.3', 'files:', '  - url: Masar-X-Setup-1.2.3-x64.exe', '    size: 500'].join('\n')),
    );

    const urls = await getLatestReleaseUrls();
    expect(urls.windowsPortable).toBe(
      'https://github.com/fotedev/Masar-x-next/releases/latest/download/Masar-X-Portable-1.2.3-x64.exe',
    );
    expect(urls.portableSizeBytes).toBe(0);
  });
});

describe('getLatestReleaseUrls — YAML fallback + loud failure on drift', () => {
  it('uses latest.yml directly when the API fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rate limited'));
    fetchMock.mockResolvedValueOnce(
      textResponse(
        ['version: 0.6.0', 'files:', '  - url: Masar-X-Setup-0.6.0-x64.exe', '    size: 42', '  - url: Masar-X-Portable-0.6.0-x64.exe', '    size: 43'].join('\n'),
      ),
    );

    const urls = await getLatestReleaseUrls();
    expect(urls.version).toBe('0.6.0');
    expect(urls.installerSizeBytes).toBe(42);
  });

  it('handles CRLF line endings and inline comments', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValueOnce(
      textResponse(
        ['version: 2.0.0  # inline comment', 'files:', '  - url: Masar-X-Setup-2.0.0-x64.exe # trailing', '    size: 77'].join('\r\n'),
      ),
    );

    const urls = await getLatestReleaseUrls();
    expect(urls.version).toBe('2.0.0');
    expect(urls.windowsInstaller.endsWith('Masar-X-Setup-2.0.0-x64.exe')).toBe(true);
    expect(urls.installerSizeBytes).toBe(77);
  });

  it('throws a loud error (with the releases page) when every strategy fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('api down'));
    fetchMock.mockResolvedValueOnce(textResponse('not: a: latest.yml', false, 404));

    await expect(getLatestReleaseUrls()).rejects.toThrow(
      /Could not fetch the latest Masar X release.*releases\/latest/,
    );
  });

  it('throws when the YAML shape drifts (no version line)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('api down'));
    // electron-builder renames `version:` → something else someday → the
    // parser must fail loud, not hand back broken URLs.
    fetchMock.mockResolvedValueOnce(
      textResponse(['releaseVersion: 3.0.0', 'files:', '  - url: Masar-X-Setup-3.0.0-x64.exe', '    size: 9'].join('\n')),
    );

    await expect(getLatestReleaseUrls()).rejects.toThrow(/Could not fetch/);
  });

  it('throws when the YAML has no Setup asset (installer pattern drift)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('api down'));
    fetchMock.mockResolvedValueOnce(
      textResponse(['version: 3.0.0', 'files:', '  - url: Masar-X-Installer.exe', '    size: 9'].join('\n')),
    );

    await expect(getLatestReleaseUrls()).rejects.toThrow(/Could not fetch/);
  });
});
