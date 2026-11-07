import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../supabase';
import { uploadToCloudinary } from '../cloudinary';

// The XHR round-trip and the FileReader conversion are stubbed wholesale;
// everything else (session lookup, header logic, response parsing, error
// taxonomy, result guard) runs for real.
vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

const getSessionMock = vi.mocked(supabase.auth.getSession);

class FakeXHR {
  static instances: FakeXHR[] = [];
  static lastBody: string | null = null;

  open = vi.fn();
  timeout = 0;
  status = 0;
  statusText = '';
  responseText = '';
  responseURL = '';
  readyState = 0;
  withCredentials = false;
  upload = { onprogress: null as null | ((event: ProgressEvent) => void) };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  headers: Record<string, string> = {};

  setRequestHeader = (name: string, value: string) => {
    this.headers[name] = value;
  };
  send = vi.fn((body: string) => {
    FakeXHR.lastBody = body;
    FakeXHR.instances.push(this);
  });
}

/** Deterministic FileReader: yields a data URL whose payload is 'QUJD' (ABC). */
class FakeFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onprogress: ((event: ProgressEvent) => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type || 'application/octet-stream'};base64,QUJD`;
    this.onload?.();
  }
}

const lastXhr = () => {
  const xhr = FakeXHR.instances.at(-1);
  if (!xhr) throw new Error('no XHR was created');
  return xhr;
};

/** Flush microtasks so uploadToCloudinary reaches xhr.send(). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const file = () => new File(['file-bytes'], 'lecture notes.png', { type: 'image/png' });

const successPayload = {
  success: true,
  url: 'https://res.cloudinary.com/demo/image/upload/v1/masarx-uploads/img.jpg',
  public_id: 'masarx-uploads/img',
  message: 'uploaded',
};

beforeEach(() => {
  FakeXHR.instances.length = 0;
  FakeXHR.lastBody = null;
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  vi.stubGlobal('FileReader', FakeFileReader);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sb.example.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: 'tok-123' } as never },
    error: null,
  } as never);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('uploadToCloudinary — request construction', () => {
  it('POSTs the edge-function URL with apikey and the Bearer token for signed users', async () => {
    const promise = uploadToCloudinary(file(), { folder: 'lectures', resourceType: 'image' });
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();

    const result = await promise;
    expect(result).toEqual(successPayload);
    expect(xhr.open).toHaveBeenCalledWith('POST', 'https://sb.example.co/functions/v1/upload-file');
    expect(xhr.headers['Content-Type']).toBe('application/json');
    expect(xhr.headers.apikey).toBe('anon-key');
    expect(xhr.headers.Authorization).toBe('Bearer tok-123');
    expect(xhr.timeout).toBe(300000);
  });

  it('omits the Authorization header for guest uploads (no session)', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null } as never);
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();

    await promise;
    expect(xhr.headers.apikey).toBe('anon-key');
    expect('Authorization' in xhr.headers).toBe(false);
  });

  it('omits the Authorization header when the session has no access token', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: {} as never },
      error: null,
    } as never);
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();
    await promise;
    expect('Authorization' in xhr.headers).toBe(false);
  });

  it('strips the data-URL prefix and sanitizes the file name in the body', async () => {
    const promise = uploadToCloudinary(file(), { folder: 'f', resourceType: 'raw' });
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();
    await promise;

    const body = JSON.parse(FakeXHR.lastBody ?? '{}');
    expect(body.file).toBe('QUJD'); // no "data:image/png;base64," prefix
    expect(body.fileName).toBe('lecture_notes.png'); // non-[a-zA-Z0-9._-] → '_'
    expect(body.contentType).toBe('image/png');
    expect(body.folder).toBe('f');
    expect(body.resourceType).toBe('raw');
  });

  it('throws before any network call when Supabase env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    await expect(uploadToCloudinary(file())).rejects.toThrow(
      'Missing Supabase environment variables',
    );
  });
});

describe('uploadToCloudinary — error taxonomy', () => {
  it('extracts the server message from a non-2xx JSON body', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 413;
    xhr.responseText = JSON.stringify({ message: 'File too large' });
    xhr.onload!();

    await expect(promise).rejects.toThrow('Upload failed: File too large');
  });

  it('falls back to the error field when message is absent', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 500;
    xhr.responseText = JSON.stringify({ error: 'quota exceeded' });
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: quota exceeded');
  });

  it('reports the status code when the body carries neither message nor error', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 500;
    xhr.responseText = JSON.stringify({ stack: '...' });
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: Upload failed (500)');
  });

  it('treats a non-JSON error body as the error string', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 502;
    xhr.responseText = 'Bad Gateway';
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: Bad Gateway');
  });

  it('maps xhr.onerror to the network-error message (CORS/DNS/drop)', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.onerror!();
    await expect(promise).rejects.toThrow('Upload failed: Network error (status: 0 unknown)');
  });

  it('maps ontimeout to the timeout message', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.ontimeout!();
    await expect(promise).rejects.toThrow(
      'Upload failed: Upload timeout - file too large or slow connection',
    );
  });
});

describe('uploadToCloudinary — result guard (isUploadResult)', () => {
  it('rejects payloads missing any of the four required fields', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ success: true, url: 'https://x' }); // no public_id/message
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: Unknown error');
  });

  it('surfaces an error field inside a 2xx payload', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ error: 'cloudinary rejected the file' });
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: cloudinary rejected the file');
  });

  it('rejects non-object payloads', async () => {
    const promise = uploadToCloudinary(file());
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = '"just a string"';
    xhr.onload!();
    await expect(promise).rejects.toThrow('Upload failed: Unknown error');
  });
});

describe('uploadToCloudinary — progress reporting', () => {
  it('reports conversion start, upload start and completion stages', async () => {
    const onProgress = vi.fn();
    const promise = uploadToCloudinary(file(), { onProgress });
    await settle();
    const xhr = lastXhr();
    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();
    await promise;

    expect(onProgress.mock.calls[0]).toEqual([0, 'تحويل الملف...']);
    expect(onProgress).toHaveBeenCalledWith(30, 'جاري رفع الملف...');
    expect(onProgress.mock.calls.at(-1)).toEqual([100, 'تم الرفع بنجاح']);
  });

  it('clamps the computed upload percentage at 99 and handles non-computable progress', async () => {
    const onProgress = vi.fn();
    const promise = uploadToCloudinary(file(), { onProgress });
    await settle();
    const xhr = lastXhr();

    xhr.upload.onprogress?.({ lengthComputable: false } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(50, 'جاري رفع الملف...');

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 1 } as ProgressEvent);
    // rawPct = 1000 → overall 30 + 700 → clamped to 99
    expect(onProgress).toHaveBeenCalledWith(99, 'جاري رفع الملف...');

    xhr.status = 200;
    xhr.responseText = JSON.stringify(successPayload);
    xhr.onload!();
    await promise;
  });
});
