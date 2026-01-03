import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create shared state that's available to hoisted mocks
const { mockResults, mockExec, clearExecMocks } = vi.hoisted(() => {
  const results: Array<{ pattern: string; result: { stdout: string; stderr: string } | Error }> = [];
  return {
    mockResults: results,
    mockExec: (cmdPattern: string, result: { stdout: string; stderr: string } | Error) => {
      results.push({ pattern: cmdPattern, result });
    },
    clearExecMocks: () => {
      results.length = 0;
    }
  };
});

// Mock child_process - need to properly support promisify
vi.mock('child_process', () => {
  // Create a properly typed exec function
  const execFn = (
    cmd: string,
    opts: unknown,
    callback?: (error: Error | null, stdout: string, stderr: string) => void
  ) => {
    // Find matching mock result based on command pattern
    let result: { stdout: string; stderr: string } | Error | undefined;
    for (const mock of mockResults) {
      if (cmd.includes(mock.pattern)) {
        result = mock.result;
        break;
      }
    }
    
    // Default empty result
    if (!result) {
      result = { stdout: '', stderr: '' };
    }
    
    if (callback) {
      // Immediate callback for promisify compatibility
      if (result instanceof Error) {
        callback(result, '', '');
      } else {
        callback(null, result.stdout, result.stderr);
      }
    }
    
    return { kill: vi.fn(), pid: 1234 };
  };

  // Add custom promisify symbol for proper promisify support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (execFn as any)[Symbol.for('nodejs.util.promisify.custom')] = (
    cmd: string,
    _opts?: unknown
  ): Promise<{ stdout: string; stderr: string }> => {
    // Find matching mock result based on command pattern
    let result: { stdout: string; stderr: string } | Error | undefined;
    for (const mock of mockResults) {
      if (cmd.includes(mock.pattern)) {
        result = mock.result;
        break;
      }
    }
    
    // Default empty result
    if (!result) {
      result = { stdout: '', stderr: '' };
    }
    
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
  };

  return {
    exec: execFn,
    default: { exec: execFn },
  };
});

// Import after mocking
import { isGitHubRetryable, hasLabelOnIssue } from './github-labels';

describe('github-labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExecMocks();
  });

  describe('isGitHubRetryable', () => {
    describe('retryable errors', () => {
      it('returns true for rate limit errors', () => {
        expect(isGitHubRetryable(new Error('API rate limit exceeded'))).toBe(true);
        expect(isGitHubRetryable(new Error('HTTP 403: rate limit'))).toBe(true);
        expect(isGitHubRetryable(new Error('You have exceeded a secondary rate limit'))).toBe(true);
      });

      it('returns true for secondary rate limit errors', () => {
        expect(isGitHubRetryable(new Error('secondary rate limit detected'))).toBe(true);
        expect(isGitHubRetryable(new Error('Secondary Rate Limit exceeded'))).toBe(true);
      });

      it('returns true for gateway errors', () => {
        expect(isGitHubRetryable(new Error('HTTP 502 Bad Gateway'))).toBe(true);
        expect(isGitHubRetryable(new Error('HTTP 503 Service Unavailable'))).toBe(true);
        expect(isGitHubRetryable(new Error('HTTP 504 Gateway Timeout'))).toBe(true);
      });

      it('returns true for network errors', () => {
        expect(isGitHubRetryable(new Error('connect ETIMEDOUT'))).toBe(true);
        expect(isGitHubRetryable(new Error('socket hang up ECONNRESET'))).toBe(true);
        expect(isGitHubRetryable(new Error('connect ECONNREFUSED'))).toBe(true);
        expect(isGitHubRetryable(new Error('getaddrinfo ENOTFOUND api.github.com'))).toBe(true);
        expect(isGitHubRetryable(new Error('request timeout'))).toBe(true);
      });
    });

    describe('non-retryable errors', () => {
      it('returns false for auth errors', () => {
        expect(isGitHubRetryable(new Error('HTTP 401 Unauthorized'))).toBe(false);
      });

      it('returns false for permission errors (non-rate-limit 403)', () => {
        expect(isGitHubRetryable(new Error('HTTP 403: Resource not accessible'))).toBe(false);
        expect(isGitHubRetryable(new Error('HTTP 403: Must have admin access'))).toBe(false);
        expect(isGitHubRetryable(new Error('Permission denied'))).toBe(false);
      });

      it('returns false for not found errors', () => {
        expect(isGitHubRetryable(new Error('HTTP 404 Not Found'))).toBe(false);
        expect(isGitHubRetryable(new Error('issue 999 not found'))).toBe(false);
      });

      it('returns false for validation errors', () => {
        expect(isGitHubRetryable(new Error('HTTP 422 Unprocessable Entity'))).toBe(false);
      });

      it('returns false for unknown errors', () => {
        expect(isGitHubRetryable(new Error('Something went wrong'))).toBe(false);
      });
    });

    describe('case insensitivity', () => {
      it('handles mixed case error messages', () => {
        expect(isGitHubRetryable(new Error('RATE LIMIT exceeded'))).toBe(true);
        expect(isGitHubRetryable(new Error('Rate Limit Exceeded'))).toBe(true);
        expect(isGitHubRetryable(new Error('ETIMEDOUT'))).toBe(true);
        expect(isGitHubRetryable(new Error('Etimedout'))).toBe(true);
      });
    });
  });

  describe('hasLabelOnIssue', () => {
    it('returns true when label exists on issue', async () => {
      mockExec('gh issue view', { 
        stdout: 'bug\nmaestro:planning\nenhancement\n', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42);
      expect(result).toBe(true);
    });

    it('returns false when label does not exist on issue', async () => {
      mockExec('gh issue view', { 
        stdout: 'bug\nenhancement\n', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42);
      expect(result).toBe(false);
    });

    it('returns false when issue has no labels', async () => {
      mockExec('gh issue view', { 
        stdout: '', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42);
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockExec('gh issue view', new Error('Network error'));

      const result = await hasLabelOnIssue('/test/project', 42);
      expect(result).toBe(false);
    });

    it('returns false when issue not found', async () => {
      mockExec('gh issue view', new Error('issue 999 not found'));

      const result = await hasLabelOnIssue('/test/project', 999);
      expect(result).toBe(false);
    });

    it('accepts custom label name', async () => {
      mockExec('gh issue view', { 
        stdout: 'custom-label\nbug\n', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42, 'custom-label');
      expect(result).toBe(true);
    });

    it('returns false for custom label when not present', async () => {
      mockExec('gh issue view', { 
        stdout: 'maestro:planning\nbug\n', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42, 'custom-label');
      expect(result).toBe(false);
    });

    it('handles whitespace in label output', async () => {
      mockExec('gh issue view', { 
        stdout: '  bug  \n  maestro:planning  \n  \n', 
        stderr: '' 
      });

      const result = await hasLabelOnIssue('/test/project', 42);
      expect(result).toBe(true);
    });
  });
});
