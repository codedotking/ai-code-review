import { NextRequest, NextResponse } from 'next/server';
import { getUserRepositories } from '@/services/giteaService';

// API 路由处理函数
export async function GET(req: NextRequest) {
  try {
    // 从请求头或 URL 参数中获取前端传递的 token
    const token = req.headers.get('x-gitea-token') || '';

    // 如果请求头中没有 token，尝试从 URL 参数获取
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未提供 Gitea 访问令牌，请先配置' },
        { status: 401 }
      );
    }
    // 使用新的 request 工具获取仓库列表，手动传入 token
    const response = await getUserRepositories(token);

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取仓库失败'
      },
      { status: 500 }
    );
  }
} 