import { NextRequest, NextResponse } from 'next/server';
import * as giteaService from '@/services/giteaService';

/**
 * Pull Request文件获取API路由
 * 
 * 该API支持两种格式获取PR的文件变更：
 * 1. 默认格式：返回文件对象数组，每个文件包含变更信息和差异补丁
 * 2. diff格式：返回整个PR的完整diff文本字符串
 * 
 * @param req NextRequest请求对象
 * @returns NextResponse包含文件变更数据或错误信息
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const pullNumber = searchParams.get('pullNumber');
  const format = searchParams.get('format') || 'default'; // 获取格式参数，默认为default
  
  // 从请求头获取 token
  const token = req.headers.get('x-gitea-token') || '';
  
  if (!token) {
    return NextResponse.json(
      { success: false, error: '未提供 Gitea 访问令牌，请先配置' },
      { status: 401 }
    );
  }
  
  // 验证必要参数是否存在
  if (!owner || !repo || !pullNumber) {
    return NextResponse.json(
      { success: false, error: '缺少必要参数 (owner, repo, pullNumber)' },
      { status: 400 }
    );
  }
  
  // 验证PR编号是否为有效数字
  const prNumber = parseInt(pullNumber);
  if (isNaN(prNumber)) {
    return NextResponse.json(
      { success: false, error: 'Pull Request编号必须是数字' },
      { status: 400 }
    );
  }
  
  try {
    // 根据format参数选择不同的数据获取方式
    if (format === 'diff') {
      // 格式为diff时，获取完整的PR差异文本
      // 这将返回一个包含所有变更文件的单一diff文本
      const diff = await giteaService.getPullRequestDiff(owner, repo, prNumber, token);
      
      if (!diff.success) {
        return NextResponse.json(
          { success: false, error: diff.error },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ success: true, data: diff.data });
    } else {
      // 默认格式，获取文件变更列表
      // 这将返回一个文件对象数组，每个对象包含单个文件的变更信息
      const files = await giteaService.getPullRequestFiles(owner, repo, prNumber, token);
      
      if (!files.success) {
        return NextResponse.json(
          { success: false, error: files.error },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ success: true, data: files.data });
    }
  } catch (error) {
    console.error('Error fetching pull request files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取Pull Request文件失败' 
      },
      { status: 500 }
    );
  }
} 