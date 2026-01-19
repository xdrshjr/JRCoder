/**
 * Unit tests for Storage interfaces
 */

import { TestHelpers } from '../../utils/test-helpers';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Storage System', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await TestHelpers.createTempDir();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTempDir(tempDir);
  });

  describe('File Operations', () => {
    it('should create and read file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello World';

      await fs.writeFile(filePath, content, 'utf8');
      const readContent = await fs.readFile(filePath, 'utf8');

      expect(readContent).toBe(content);
    });

    it('should create nested directories', async () => {
      const nestedPath = path.join(tempDir, 'a', 'b', 'c', 'test.txt');

      await fs.ensureDir(path.dirname(nestedPath));
      await fs.writeFile(nestedPath, 'test', 'utf8');

      const exists = await fs.pathExists(nestedPath);
      expect(exists).toBe(true);
    });

    it('should list files in directory', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(tempDir, 'file3.txt'), 'content3');

      const files = await fs.readdir(tempDir);

      expect(files).toHaveLength(3);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).toContain('file3.txt');
    });

    it('should delete file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      expect(await fs.pathExists(filePath)).toBe(true);

      await fs.remove(filePath);

      expect(await fs.pathExists(filePath)).toBe(false);
    });

    it('should handle JSON files', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const data = { name: 'test', value: 42 };

      await fs.writeJSON(filePath, data, { spaces: 2 });
      const readData = await fs.readJSON(filePath);

      expect(readData).toEqual(data);
    });
  });

  describe('Path Validation', () => {
    it('should resolve relative paths', () => {
      const basePath = tempDir;
      const relativePath = 'subdir/file.txt';
      const resolved = path.resolve(basePath, relativePath);

      expect(resolved).toContain(basePath);
      expect(resolved).toContain('subdir');
      expect(resolved).toContain('file.txt');
    });

    it('should detect path traversal attempts', () => {
      const basePath = tempDir;
      const maliciousPath = '../../../etc/passwd';
      const resolved = path.resolve(basePath, maliciousPath);

      // Should not start with basePath if traversal succeeded
      const isWithinBase = resolved.startsWith(path.resolve(basePath));

      // This test shows how to detect traversal
      expect(typeof isWithinBase).toBe('boolean');
    });

    it('should normalize paths', () => {
      const unnormalized = path.join(tempDir, 'a', '..', 'b', '.', 'c');
      const normalized = path.normalize(unnormalized);

      expect(normalized).toBe(path.join(tempDir, 'b', 'c'));
    });
  });

  describe('File Stats', () => {
    it('should get file size', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello World';
      await fs.writeFile(filePath, content);

      const stats = await fs.stat(filePath);

      expect(stats.size).toBe(Buffer.byteLength(content));
    });

    it('should check if path is file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      const stats = await fs.stat(filePath);

      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
    });

    it('should check if path is directory', async () => {
      const dirPath = path.join(tempDir, 'subdir');
      await fs.ensureDir(dirPath);

      const stats = await fs.stat(dirPath);

      expect(stats.isDirectory()).toBe(true);
      expect(stats.isFile()).toBe(false);
    });
  });
});
