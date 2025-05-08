import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { giteaUrl, giteaToken, openaiKey } = body;
    
    // 在生产环境中，这些值应当保存到数据库或其他持久化存储
    // 前端已经保存到 localStorage，这里只设置 API URL 环境变量
    // 因为它在服务端渲染时可能需要
    if (giteaUrl) {
      process.env.NEXT_PUBLIC_GITEA_API_URL = giteaUrl;
    }
    
    // 不再设置 token，因为它现在从客户端获取
    // 仍保留 OpenAI API Key 的设置，因为它可能在服务端需要
    if (openaiKey) {
      process.env.OPENAI_API_KEY = openaiKey;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '设置已保存' 
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '保存设置失败' 
      },
      { status: 500 }
    );
  }
} 