import { NextRequest, NextResponse } from 'next/server';
import { CodeReviewRequest, GiteaPullRequest } from '@/types';
import * as giteaService from '@/services/giteaService';
import { generateCodeReview } from '@/services/aiService';

/**
 * 代码审查API
 * 
 * 该模块提供了代码审查的API端点，主要功能包括：
 * 1. 接收包含仓库和PR信息的请求
 * 2. 从Gitea API获取PR详情和文件变更
 * 3. 调用AI服务生成代码审查
 * 4. 返回格式化的审查结果
 */

/**
 * 处理POST请求，生成新的代码审查
 * 
 * @param req 包含仓库名和PR编号的请求
 * @returns 包含代码审查结果或错误信息的响应
 */
export async function POST(req: NextRequest) {
  try {
    // 从请求头获取 token
    const token = req.headers.get('x-gitea-token') || '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未提供 Gitea 访问令牌，请先配置' },
        { status: 401 }
      );
    }
    
    // 解析请求体，获取仓库名和PR编号
    const body = await req.json() as CodeReviewRequest;
    const { repositoryFullName, pullRequestNumber } = body;

    // 验证必要参数
    if (!repositoryFullName || !pullRequestNumber) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 拆分仓库全名为owner和repo
    // 例如: "owner/repo" => ["owner", "repo"]
    const [owner, repo] = repositoryFullName.split('/');
    // 步骤1: 获取Pull Request详情
    // 包括PR的标题、描述、状态等基本信息
    const prResponse = await giteaService.getPullRequest(owner, repo, pullRequestNumber, token);
    if (!prResponse.success || !prResponse.data) {
      return NextResponse.json(
        { success: false, error: `获取PR详情失败: ${prResponse.error}` },
        { status: 500 }
      );
    }
    const pullRequest: GiteaPullRequest = prResponse.data;
    // 步骤2.1: 获取完整的PR差异信息
    // 这将获取整个PR的完整diff文本，包含所有文件变更的详细信息
    const diffResponse = await giteaService.getPullRequestDiff(owner, repo, pullRequestNumber, token);
    if (!diffResponse.success || !diffResponse.data) {
      return NextResponse.json(
        { success: false, error: `获取完整差异失败: ${diffResponse.error}` },
        { status: 500 }
      );
    }
    console.log(diffResponse);
    // 步骤4: 调用AI服务生成代码审查
    // 传入PR标题、描述和差异信息
    const reviewResponse = await generateCodeReview(
      pullRequest.title,
      pullRequest.body || '',
      diffResponse.data
    );

    if (!reviewResponse.success || !reviewResponse.data) {
      return NextResponse.json(
        { success: false, error: `生成代码审查失败: ${reviewResponse.error}` },
        { status: 500 }
      );
    }

    const review = reviewResponse.data;

    // 设置Pull Request ID，便于后续跟踪和关联
    review.pullRequestId = pullRequest.id;

    // 步骤5: 返回代码审查结果
    // 在实际应用中，可能还需要将审查结果保存到数据库
    return NextResponse.json({ success: true, data: review });

  } catch (error) {
    // 处理过程中出现的任何未捕获异常
    console.error('Error processing code review:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理代码审查请求失败'
      },
      { status: 500 }
    );
  }
}

/**
 * 处理GET请求，获取历史代码审查
 * 
 * 注意：当前版本不支持历史记录检索
 * 实际应用中应使用数据库存储审查结果，并提供检索功能
 * 
 * @param req 请求对象
 * @returns 包含错误信息的响应，表明功能尚未实现
 */
export async function GET() {
  // 演示目的，实际应用中应连接数据库存储和检索审查记录
  return NextResponse.json(
    { success: false, error: '暂不支持检索历史审查记录' },
    { status: 501 }
  );
} 