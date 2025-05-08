// Gitea API 类型定义
export interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GiteaCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

export interface GiteaFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  raw_url: string;
  contents_url: string;
}

// 代码审查相关类型
export interface CodeReviewRequest {
  repositoryFullName: string;
  pullRequestNumber: number;
}

export interface CodeReviewResponse {
  id: string;
  pullRequestId: number;
  summary: string;
  suggestions: CodeReviewSuggestion[];
  createdAt: string;
}

export interface CodeReviewSuggestion {
  id: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  suggestion: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
} 