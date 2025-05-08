import { NextRequest, NextResponse } from 'next/server';
import * as giteaService from '@/services/giteaService';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const pullNumber = searchParams.get('pullNumber');
  // 从请求头获取 token
  const token = req.headers.get('x-gitea-token') || '';
  if (!token) {
    return NextResponse.json(
      { success: false, error: '未提供 Gitea 访问令牌，请先配置' },
      { status: 401 }
    );
  }

  if (!owner || !repo) {
    return NextResponse.json(
      { success: false, error: '缺少必要参数 (owner, repo)' },
      { status: 400 }
    );
  }

  try {
    // 如果提供了 PR 编号，则获取单个PR详情
    if (pullNumber) {
      const prNumber = parseInt(pullNumber);
      if (isNaN(prNumber)) {
        return NextResponse.json(
          { success: false, error: 'Pull Request编号必须是数字' },
          { status: 400 }
        );
      }
      const pullRequest = await giteaService.getPullRequest(owner, repo, prNumber, token);
      if (!pullRequest.success) {
        return NextResponse.json(
          { success: false, error: pullRequest.error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: pullRequest.data });
    }

    // 否则获取仓库的所有PR
    const pullRequests = await giteaService.getRepositoryPullRequests(owner, repo, token);

    if (!pullRequests.success) {
      return NextResponse.json(
        { success: false, error: pullRequests.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: pullRequests.data });
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取Pull Request失败'
      },
      { status: 500 }
    );
  }
} 