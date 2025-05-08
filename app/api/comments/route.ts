import { NextRequest, NextResponse } from 'next/server';
import { CodeReviewResponse } from '@/types';
import * as giteaService from '@/services/giteaService';

/**
 * 代码审查评论API
 * 
 * 本模块负责将代码审查结果发布为Pull Request评论
 * 主要功能包括：
 * 1. 接收代码审查结果和目标PR信息
 * 2. 将审查结果转换为格式化的Markdown评论
 * 3. 通过Gitea API将评论发布到Pull Request
 */

/**
 * 处理POST请求，将代码审查结果发布为PR评论
 * 
 * @param req 包含仓库名、PR编号和审查结果的请求
 * @returns 包含操作结果或错误信息的响应
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
    
    // 解析请求体，获取仓库信息、PR编号和审查结果
    const body = await req.json();
    const { repositoryFullName, pullRequestNumber, review } = body;
    
    // 验证必要参数是否存在
    if (!repositoryFullName || !pullRequestNumber || !review) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    // 拆分仓库全名为owner和repo
    // 例如: "owner/repo" => ["owner", "repo"]
    const [owner, repo] = repositoryFullName.split('/');
    
    // 将审查结果转换为格式化的Markdown评论
    const commentBody = formatReviewAsComment(review as CodeReviewResponse);
    
    // 通过Gitea API将评论添加到PR
    const commentResponse = await giteaService.addPullRequestComment(
      owner,
      repo,
      pullRequestNumber,
      commentBody
    );
    
    // 检查评论是否添加成功
    if (!commentResponse.success) {
      return NextResponse.json(
        { success: false, error: `添加评论失败: ${commentResponse.error}` },
        { status: 500 }
      );
    }
    
    // 返回成功响应
    return NextResponse.json({ 
      success: true, 
      data: { message: '已成功将代码审查评论添加到Pull Request' } 
    });
    
  } catch (error) {
    // 处理过程中出现的任何未捕获异常
    console.error('Error adding review comment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '处理评论请求失败' 
      },
      { status: 500 }
    );
  }
}

/**
 * 将代码审查结果格式化为Markdown评论
 * 
 * 生成的评论包含以下部分：
 * - 标题和总体评价
 * - 按文件分组的具体建议
 * - 每个建议的严重程度、行号、原始代码和改进建议
 * - 生成时间的页脚
 * 
 * @param review 代码审查结果对象
 * @returns 格式化的Markdown文本
 */
function formatReviewAsComment(review: CodeReviewResponse): string {
  // 添加标题和总体评价
  let comment = `## AI 代码审查结果\n\n`;
  comment += `### 总体评价\n\n${review.summary}\n\n`;
  
  if (review.suggestions.length > 0) {
    comment += `### 具体建议\n\n`;
    
    // 按文件分组建议，便于阅读和查看
    const suggestionsByFile: Record<string, typeof review.suggestions> = {};
    review.suggestions.forEach(suggestion => {
      if (!suggestionsByFile[suggestion.file]) {
        suggestionsByFile[suggestion.file] = [];
      }
      suggestionsByFile[suggestion.file].push(suggestion);
    });
    
    // 遍历每个文件的建议，生成Markdown格式内容
    for (const [filename, suggestions] of Object.entries(suggestionsByFile)) {
      comment += `#### ${filename}\n\n`;
      
      suggestions.forEach(suggestion => {
        // 添加严重程度对应的emoji，提高视觉效果
        const severityEmoji = getSeverityEmoji(suggestion.severity);
        comment += `${severityEmoji} **${suggestion.severity.toUpperCase()}** (第 ${suggestion.lineStart}-${suggestion.lineEnd} 行)：\n\n`;
        
        // 使用代码块显示原始代码
        comment += "```\n" + suggestion.content + "\n```\n\n";
        
        // 添加改进建议
        comment += `建议: ${suggestion.suggestion}\n\n`;
      });
    }
  } else {
    // 没有建议时显示积极的反馈
    comment += `### 没有发现需要改进的地方，代码质量良好！\n\n`;
  }
  
  // 添加页脚，包含生成时间
  comment += `---\n*由 AI 代码审查助手自动生成于 ${new Date().toLocaleString()}*`;
  
  return comment;
}

/**
 * 获取严重程度对应的emoji图标
 * 
 * 使用emoji可以在评论中直观地表示问题的严重程度:
 * - 红色圆点: 严重问题
 * - 橙色圆点: 主要问题
 * - 黄色圆点: 次要问题
 * - 蓝色圆点: 信息提示
 * 
 * @param severity 严重程度字符串
 * @returns 对应的emoji图标
 */
function getSeverityEmoji(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '🔴';
    case 'major':
      return '🟠';
    case 'minor':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '📝';
  }
} 