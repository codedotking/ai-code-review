import OpenAI from 'openai';
import { CodeReviewResponse, ApiResponse } from '@/types';
import { PromptTemplateManager } from '@/prompts';

/**
 * AI代码审查服务
 * 
 * 本模块负责与OpenAI/DeepSeek API交互，生成智能代码审查结果。
 * 主要功能包括：
 * 1. 使用模板生成适合代码审查的提示词(prompt)
 * 2. 调用AI API进行代码分析
 * 3. 解析和格式化AI返回的审查结果
 */

// 初始化OpenAI客户端，配置为使用DeepSeek API
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1',
});

// 初始化提示词模板管理器
const promptManager = new PromptTemplateManager();

/**
 * 生成AI代码审查
 * 
 * 该函数是模块的主要导出函数，用于生成完整的代码审查结果
 * 
 * @param title Pull Request的标题
 * @param description Pull Request的描述
 * @param files 需要审查的文件差异字符串
 * @returns 包含审查结果或错误信息的ApiResponse对象
 */
export async function generateCodeReview(
  title: string,
  description: string,
  files: string
): Promise<ApiResponse<CodeReviewResponse>> {
  try {
    // 使用模板管理器生成提示词
    const prompts = promptManager.generateCodeReviewPrompt(
      title,
      description, 
      files
    );
    console.log(prompts.systemPrompt);

    // 根据配置选择使用的模型
    const model = process.env.DEEPSEEK_API_MODEL || "deepseek-coder";
    
    
    // 调用AI的chat completions API
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        // 系统消息定义AI的角色和行为方式
        { role: "system", content: prompts.systemPrompt },
        // 用户消息包含实际的代码审查请求
        { role: "user", content: prompts.userPrompt }
      ],
      temperature: 0.2, // 低温度值，使回复更加确定性和准确
    });

    
    // 获取AI的回复内容
    const content = completion.choices[0].message.content || ''; // 防止null值
    console.log(content);
    
    if (!content) {
      throw new Error('AI响应为空');
    }   

    // 构造标准化的响应格式
    const review: CodeReviewResponse = {
      id: Date.now().toString(), // 使用时间戳作为ID
      pullRequestId: 0, // 在API层设置实际的PR ID
      summary: content, // 直接使用AI返回的Markdown内容
      suggestions: [], // 新格式不再返回结构化建议
      createdAt: new Date().toISOString(), // 记录创建时间
    };
    
    // 返回成功结果
    return { success: true, data: review };
  } catch (error) {
    // 出现错误时，记录详细错误并返回友好的错误信息
    console.error('Error generating code review:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'AI代码审查生成失败' 
    };
  }
} 