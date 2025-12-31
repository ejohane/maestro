import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// Setup mock results storage
const mockResults: Map<string, { stdout: string; stderr: string } | Error> = new Map();

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
    for (const [pattern, value] of mockResults.entries()) {
      if (cmd.includes(pattern)) {
        result = value;
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
    for (const [pattern, value] of mockResults.entries()) {
      if (cmd.includes(pattern)) {
        result = value;
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

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { worktreeService, WorktreeError } from './worktree';

// Helper to set mock result
function mockExec(cmdPattern: string, result: { stdout: string; stderr: string } | Error) {
  mockResults.set(cmdPattern, result);
}

// Helper to clear all mocks
function clearExecMocks() {
  mockResults.clear();
}

describe('WorktreeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExecMocks();
  });

  describe('getBranchName', () => {
    it('should generate correct branch name from issue number and title', () => {
      const result = worktreeService.getBranchName(6, 'Planning Mode Feature');
      expect(result).toBe('feature/issue-6-planning-mode-feature');
    });

    it('should handle special characters in title', () => {
      const result = worktreeService.getBranchName(42, 'Fix: Bug #123 in user/auth');
      expect(result).toBe('feature/issue-42-fix-bug-123-in-user-auth');
    });

    it('should truncate long titles to 50 characters', () => {
      const longTitle = 'This is a very long title that should be truncated because it exceeds the maximum length';
      const result = worktreeService.getBranchName(1, longTitle);
      // The slug portion should be at most 50 chars
      const slugPart = result.replace('feature/issue-1-', '');
      expect(slugPart.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty title', () => {
      const result = worktreeService.getBranchName(99, '');
      expect(result).toBe('feature/issue-99-');
    });
  });

  describe('getProjectSlug', () => {
    it('should extract slug from git remote URL (https)', async () => {
      mockExec('remote get-url origin', { 
        stdout: 'https://github.com/user/my-awesome-repo.git\n', 
        stderr: '' 
      });

      const result = await worktreeService.getProjectSlug('/test/project');
      expect(result).toBe('my-awesome-repo');
    });

    it('should extract slug from git remote URL (ssh)', async () => {
      mockExec('remote get-url origin', { 
        stdout: 'git@github.com:user/my-project.git\n', 
        stderr: '' 
      });

      const result = await worktreeService.getProjectSlug('/test/project');
      expect(result).toBe('my-project');
    });

    it('should fallback to directory basename if no remote', async () => {
      mockExec('remote get-url origin', new Error('No remote'));

      const result = await worktreeService.getProjectSlug('/home/user/my-local-project');
      expect(result).toBe('my-local-project');
    });
  });

  describe('getWorktreePath', () => {
    it('should return correct worktree path', async () => {
      mockExec('remote get-url origin', { 
        stdout: 'https://github.com/user/test-repo.git\n', 
        stderr: '' 
      });

      const result = await worktreeService.getWorktreePath('/test/project', 42);
      const expectedPath = path.join(os.homedir(), '.maestro', 'worktrees', 'test-repo', 'issue-42');
      expect(result).toBe(expectedPath);
    });
  });

  describe('getDefaultBranch', () => {
    it('should return main from symbolic-ref', async () => {
      mockExec('symbolic-ref', { stdout: 'origin/main\n', stderr: '' });

      const result = await worktreeService.getDefaultBranch('/test/project');
      expect(result).toBe('main');
    });

    it('should fallback to checking if main exists', async () => {
      mockExec('symbolic-ref', new Error('No symbolic ref'));
      mockExec('rev-parse --verify main', { stdout: 'abc123\n', stderr: '' });

      const result = await worktreeService.getDefaultBranch('/test/project');
      expect(result).toBe('main');
    });

    it('should fallback to master if main does not exist', async () => {
      mockExec('symbolic-ref', new Error('No symbolic ref'));
      mockExec('rev-parse --verify main', new Error('No main'));

      const result = await worktreeService.getDefaultBranch('/test/project');
      expect(result).toBe('master');
    });
  });

  describe('branchExists', () => {
    it('should return true if branch exists', async () => {
      mockExec('rev-parse --verify', { stdout: 'abc123\n', stderr: '' });

      const result = await worktreeService.branchExists('/test/project', 'feature/test');
      expect(result).toBe(true);
    });

    it('should return false if branch does not exist', async () => {
      mockExec('rev-parse --verify', new Error('Branch not found'));

      const result = await worktreeService.branchExists('/test/project', 'feature/nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('WorktreeError', () => {
    it('should create error with correct properties', () => {
      const error = new WorktreeError(
        'Test error message',
        'NOT_GIT_REPO',
        'Additional details'
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('NOT_GIT_REPO');
      expect(error.details).toBe('Additional details');
      expect(error.name).toBe('WorktreeError');
    });

    it('should work without details', () => {
      const error = new WorktreeError('Test error', 'GIT_ERROR');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('GIT_ERROR');
      expect(error.details).toBeUndefined();
    });
  });
});
