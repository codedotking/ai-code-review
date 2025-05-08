/**
 * 表示差异数据结构的类型
 */
export interface FileDiff {
  oldFile: string;
  newFile: string;
  isDeleted: boolean;
  isNew: boolean;
  chunks: DiffChunk[];
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * 使用正则表达式切分 git diff 字符串，返回以文件名为键的差异内容映射
 * @param diffStr 要解析的 git diff 字符串
 * @returns 包含每个文件差异的映射，格式为 {文件名: 差异内容}
 */
export function splitDiffByFiles(diffStr: string): Record<string, string> {
  // 正则表达式用于查找每个文件差异的起始位置
  const filePattern = /diff --git a\/(.*?) b\/(.*?)\n/g;
  
  // 查找所有文件头部信息的位置
  const fileHeaders: Array<{
    index: number;
    fileName: string;
    match: RegExpExecArray;
  }> = [];
  
  let match: RegExpExecArray | null;
  // 重置正则表达式状态
  filePattern.lastIndex = 0;
  
  // 查找所有匹配项
  while ((match = filePattern.exec(diffStr)) !== null) {
    fileHeaders.push({
      index: match.index,
      fileName: match[1], // 使用第一个捕获组作为文件名
      match
    });
  }
  
  // 用于存储文件差异的映射
  const fileDiffs: Record<string, string> = {};
  
  // 处理每个文件的差异
  for (let i = 0; i < fileHeaders.length; i++) {
    const currentHeader = fileHeaders[i];
    const fileName = currentHeader.fileName;
    
    // 计算当前差异的结束位置
    let endPos: number;
    if (i < fileHeaders.length - 1) {
      endPos = fileHeaders[i + 1].index;
    } else {
      endPos = diffStr.length;
    }
    
    // 提取此文件的完整差异内容
    const fileDiff = diffStr.substring(currentHeader.index, endPos);
    fileDiffs[fileName] = fileDiff;
  }
  
  return fileDiffs;
}

/**
 * 提取特定文件的 diff 内容
 * @param diffStr 完整的 diff 内容字符串
 * @param fileName 要提取的文件名
 * @returns 该文件的 diff 内容，如果未找到则返回 null
 */
export function extractFileDiff(diffStr: string, fileName: string): string | null {
  const fileDiffs = splitDiffByFiles(diffStr);
  return fileDiffs[fileName] || null;
}

/**
 * 解析 git diff 字符串并返回有关更改的结构化数据
 * @param diffStr 要解析的 git diff 字符串
 * @returns 表示每个文件更改的 FileDiff 对象数组
 */
export function parseDiff(diffStr: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  let currentDiff: FileDiff | null = null;
  let currentChunk: DiffChunk | null = null;
  
  const lines = diffStr.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 文件头
    if (line.startsWith('diff --git ')) {
      if (currentDiff) {
        diffs.push(currentDiff);
      }
      
      // 初始化新的文件差异
      currentDiff = {
        oldFile: '',
        newFile: '',
        isDeleted: false,
        isNew: false,
        chunks: []
      };
      
      continue;
    }
    
    if (!currentDiff) continue;
    
    // 文件名
    if (line.startsWith('--- a/')) {
      currentDiff.oldFile = line.substring(6);
    } else if (line.startsWith('+++ b/')) {
      currentDiff.newFile = line.substring(6);
    } else if (line.startsWith('+++ /dev/null')) {
      currentDiff.isDeleted = true;
    } else if (line.startsWith('--- /dev/null')) {
      currentDiff.isNew = true;
    } else if (line.startsWith('index ') || line.startsWith('new file mode ') || 
               line.startsWith('deleted file mode ')) {
      // 索引信息 - 对于基本解析可以跳过
      continue;
    } else if (line.startsWith('@@ ')) {
      // 块头
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      
      if (match) {
        currentChunk = {
          oldStart: parseInt(match[1]),
          oldLines: match[2] ? parseInt(match[2]) : 1,
          newStart: parseInt(match[3]),
          newLines: match[4] ? parseInt(match[4]) : 1,
          lines: []
        };
        
        currentDiff.chunks.push(currentChunk);
      }
    } else if (currentChunk) {
      // 内容行
      if (line.startsWith('+')) {
        currentChunk.lines.push({
          type: 'added',
          content: line.substring(1),
          newLineNumber: currentChunk.newStart++
        });
      } else if (line.startsWith('-')) {
        currentChunk.lines.push({
          type: 'removed',
          content: line.substring(1),
          oldLineNumber: currentChunk.oldStart++
        });
      } else if (line.startsWith(' ')) {
        currentChunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: currentChunk.oldStart++,
          newLineNumber: currentChunk.newStart++
        });
      } else if (line === '\\ No newline at end of file') {
        // 文件末尾没有换行符标记 - 对于基本解析可以忽略
        continue;
      }
    }
  }
  
  // 如果存在，添加最后一个 diff
  if (currentDiff) {
    diffs.push(currentDiff);
  }
  
  return diffs;
}

/**
 * 获取 diff 中更改的摘要
 * @param diffStr 要汇总的 git diff 字符串
 * @returns 包含摘要信息的对象
 */
export function summarizeDiff(diffStr: string): {
  filesChanged: number;
  insertions: number;
  deletions: number;
  fileChanges: Array<{file: string, insertions: number, deletions: number, isDeleted: boolean, isNew: boolean}>
} {
  const diffs = parseDiff(diffStr);
  
  let totalInsertions = 0;
  let totalDeletions = 0;
  const fileChanges = [];
  
  for (const diff of diffs) {
    let fileInsertions = 0;
    let fileDeletions = 0;
    
    for (const chunk of diff.chunks) {
      for (const line of chunk.lines) {
        if (line.type === 'added') fileInsertions++;
        if (line.type === 'removed') fileDeletions++;
      }
    }
    
    totalInsertions += fileInsertions;
    totalDeletions += fileDeletions;
    
    fileChanges.push({
      file: diff.isDeleted ? diff.oldFile : diff.newFile,
      insertions: fileInsertions,
      deletions: fileDeletions,
      isDeleted: diff.isDeleted,
      isNew: diff.isNew
    });
  }
  
  return {
    filesChanged: diffs.length,
    insertions: totalInsertions,
    deletions: totalDeletions,
    fileChanges
  };
}
