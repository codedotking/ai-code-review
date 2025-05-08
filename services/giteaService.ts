import axios from 'axios';
import { GiteaRepository, GiteaPullRequest, GiteaFile, ApiResponse } from '@/types';
import { splitDiffByFiles, summarizeDiff } from '@/lib/diff';

// 环境变量中获取Gitea API配置
const GITEA_API_URL = process.env.NEXT_PUBLIC_GITEA_API_URL || '';

// 创建动态获取 token 的函数
const getGiteaToken = (): string => {
  // 在浏览器环境中从 localStorage 获取 token
  if (typeof window !== 'undefined') {
    return localStorage.getItem('giteaToken') || '';
  }
  // 在服务器端环境中使用环境变量作为后备选项
  return process.env.GITEA_TOKEN || '';
};

// 辅助函数：检查是否已配置token
export function hasGiteaToken(): boolean {
  return !!getGiteaToken();
}

// 重定向到设置页面
export function redirectToSettings(message: string = '请先配置 Gitea 访问令牌'): void {
  if (typeof window !== 'undefined') {
    alert(message);
    window.location.href = '/settings';
  }
}

// 创建Axios实例，使用函数获取最新 token
const giteaAxios = axios.create({
  baseURL: GITEA_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器，动态设置 token 并打印完整请求URL
giteaAxios.interceptors.request.use(config => {
  // 每次请求时获取最新的 token
  const token = getGiteaToken();
  console.log('token', token);

  if (!token && typeof window !== 'undefined') {
    // 如果没有 token 且在浏览器环境中，重定向到设置页面
    redirectToSettings();
    throw new Error('缺少 Gitea 访问令牌，请先在设置页面配置');
  }

  if (token) {
    config.headers['Authorization'] = `token ${token}`;
  }

  console.log('Actual request URL:', `${config.baseURL}${config.url}`);
  console.log('Request headers:', config.headers);
  return config;
});

// 获取用户仓库列表
export async function getUserRepositories(token: string): Promise<ApiResponse<GiteaRepository[]>> {
  try {
    // 根据Gitea API文档，尝试不同的API端点
    // 1. 尝试 /user/repos 获取当前认证用户的仓库
    console.log('尝试请求端点: /user/repos');
    const response = await giteaAxios.get(`/user/repos`, {
      headers: {
        'Authorization': `token ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching repositories:', error);
    try {
      // 2. 如果上面失败，尝试 /repos/search 搜索所有可见仓库
      console.log('尝试备选请求端点: /repos/search');
      const searchResponse = await giteaAxios.get(`/repos/search`);
      return { success: true, data: searchResponse.data.data || [] };
    } catch (searchError) {
      console.error('Error with fallback repositories search:', searchError);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取仓库失败'
      };
    }
  }
}

// 获取仓库中的Pull Request列表
export async function getRepositoryPullRequests(
  owner: string,
  repo: string,
  token: string
): Promise<ApiResponse<GiteaPullRequest[]>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/pulls`;
    console.log('Full request URL:', `${GITEA_API_URL}${endpoint}`);
    const response = await giteaAxios.get(endpoint, {
      headers: {
        'Authorization': `token ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取Pull Request失败'
    };
  }
}

// 获取单个Pull Request的详细信息
export async function getPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<ApiResponse<GiteaPullRequest>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}`;
    const response = await giteaAxios.get(endpoint, {
      headers: {
        'Authorization': `token ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error fetching pull request #${pullNumber}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取Pull Request详情失败'
    };
  }
}

// 获取Pull Request中更改的文件列表
export async function getPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<ApiResponse<GiteaFile[]>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
    console.log('Full request URL:', `${GITEA_API_URL}${endpoint}`);
    const response = await giteaAxios.get(endpoint, {
      headers: {
        'Authorization': `token ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error fetching files for PR #${pullNumber}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取文件差异失败'
    };
  }
}

// 获取文件内容
export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref: string
): Promise<ApiResponse<string>> {
  try {
    const endpoint = `/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
    console.log('Full request URL:', `${GITEA_API_URL}${endpoint}`);
    const response = await giteaAxios.get(endpoint);
    // 内容通常是Base64编码的
    const content = Buffer.from(response.data.content, 'base64').toString();
    return { success: true, data: content };
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取文件内容失败'
    };
  }
}

// 添加评论到PR
export async function addPullRequestComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<ApiResponse<{ id: number; body: string }>> {
  try {
    // {self.gitea_url}/api/v1/repos/{self.repo_full_name}/issues/{self.pull_request_number}/comments
    const endpoint = `/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
    const response = await giteaAxios.post(
      endpoint,
      { body }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error adding comment to PR #${pullNumber}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '添加评论失败'
    };
  }
}

// 获取Pull Request的完整diff
export async function getPullRequestDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<ApiResponse<string>> {
  try {
    // 使用.diff后缀获取diff格式的文件变更
    // Gitea API提供了一个特殊的端点，允许我们直接获取完整的diff文本
    // 格式为：/api/v1/repos/{owner}/{repo}/pulls/{pull_number}.diff
    const endpoint = `/repos/${owner}/${repo}/pulls/${pullNumber}.diff`;

    // 创建一个新的请求配置，专门处理diff响应
    // 1. responseType设为text，因为返回的是文本格式，而不是JSON
    // 2. 使用 transformResponse 防止axios默认的JSON解析，保留原始文本
    const response = await giteaAxios.get(endpoint, {
      headers: {
        'Authorization': `token ${token}`
      },
      responseType: 'text',
      transformResponse: [(data) => data], // 保留原始文本，不做任何转换
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error fetching diff for PR #${pullNumber}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取PR的diff失败'
    };
  }
}

// 处理diff字符串并转换为GiteaFile格式的文件数组
export function processDiffToGiteaFiles(diffContent: string): GiteaFile[] {
  // 使用 splitDiffByFiles 按文件切分 diff 内容
  const fileDiffs = splitDiffByFiles(diffContent);

  // 创建文件数组，每个文件创建一个条目
  const parsedFiles: GiteaFile[] = Object.entries(fileDiffs).map(([fileName, fileDiff]) => {
    // 解析这个文件的 diff 来获取变更统计信息
    const fileDiffStr = fileDiff as string;
    const fileSummary = summarizeDiff(fileDiffStr);

    const isDeleted = fileDiffStr.includes('+++ /dev/null');
    const isNew = fileDiffStr.includes('--- /dev/null');

    return {
      filename: fileName,
      status: isDeleted ? 'removed' : isNew ? 'added' : 'modified',
      additions: fileSummary.insertions,
      deletions: fileSummary.deletions,
      changes: fileSummary.insertions + fileSummary.deletions,
      patch: fileDiffStr, // 使用这个文件的差异内容作为补丁
      raw_url: '',
      contents_url: ''
    };
  });

  // 如果没有解析到文件，则返回空数组
  return parsedFiles;
} 