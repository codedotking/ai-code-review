import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import nunjucks from 'nunjucks';

/**
 * 定义模板结构的接口
 */
interface PromptTemplate {
  system_prompt: string;
  user_prompt_template: string;
}

/**
 * 模板管理类，负责加载和应用提示词模板
 */
export class PromptTemplateManager {
  private templates: Record<string, PromptTemplate> = {};
  private templatesDir: string;
  private nunjucksEnv: nunjucks.Environment;

  /**
   * 创建一个新的模板管理器实例
   * @param templatesDir 模板文件所在目录的路径
   */
  constructor(templatesDir: string = path.join(process.cwd(), 'prompts')) {
    this.templatesDir = templatesDir;
    this.nunjucksEnv = nunjucks.configure({ autoescape: true });
  }

  /**
   * 加载指定名称的YAML模板文件
   * @param templateName 模板文件名（不含.yml扩展名）
   * @returns 当前实例，用于链式调用
   */
  loadTemplate(templateName: string): PromptTemplateManager {
    const templatePath = path.join(this.templatesDir, `${templateName}.yml`);
    
    try {
      // 读取YAML文件内容
      const fileContent = fs.readFileSync(templatePath, 'utf8');
      // 解析YAML为JavaScript对象
      this.templates[templateName] = yaml.parse(fileContent) as PromptTemplate;
      return this;
    } catch (error) {
      console.error(`Error loading template "${templateName}":`, error);
      throw new Error(`Failed to load template "${templateName}"`);
    }
  }

  /**
   * 应用模板，使用提供的数据渲染指定的模板
   * @param templateName 模板名称
   * @param data 要应用到模板的数据
   * @returns 渲染后的系统提示词和用户提示词
   */
  applyTemplate(templateName: string, data: Record<string, unknown>): { systemPrompt: string, userPrompt: string } {
    // 如果模板尚未加载，则加载它
    if (!this.templates[templateName]) {
      this.loadTemplate(templateName);
    }

    const template = this.templates[templateName];
    
    // 使用Nunjucks渲染模板
    const systemPrompt = this.nunjucksEnv.renderString(template.system_prompt, data);
    const userPrompt = this.nunjucksEnv.renderString(template.user_prompt_template, data);
    
    return {
      systemPrompt,
      userPrompt
    };
  }

  /**
   * 专门用于生成代码审查提示词的便捷方法
   * @param title Pull Request的标题
   * @param description Pull Request的描述
   * @param files 文件列表，包含文件名和差异信息
   * @returns 渲染后的系统提示词和用户提示词
   */
  generateCodeReviewPrompt(
    title: string, 
    description: string, 
    files: string
  ): { systemPrompt: string, userPrompt: string } {
    return this.applyTemplate('codereview', {
      title,
      description,
      files,
      diffs_text: files
    });
  }
} 