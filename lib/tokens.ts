import { hasToken } from './request';

type TokenType = 'gitea' | 'openai';

/**
 * 检查是否有指定类型的 token
 * 
 * @param type token 类型 ('gitea' | 'openai')
 * @returns boolean 是否存在有效 token
 */
export function checkToken(type: TokenType = 'gitea'): boolean {
  return hasToken(type);
}

/**
 * 重定向到设置页面
 * 
 * @param message 提示信息
 * @param tokenType 缺少的 token 类型
 */
export function redirectToSettings(message?: string, tokenType: TokenType = 'gitea'): void {
  if (typeof window === 'undefined') {
    return; // 服务端环境不处理
  }
  
  const defaultMessages = {
    gitea: '请先配置 Gitea 访问令牌，才能继续操作',
    openai: '请先配置 OpenAI API 密钥，才能继续操作'
  };
  
  // 使用提供的消息或默认消息
  const alertMessage = message || defaultMessages[tokenType];
  
  // 显示提示并重定向
  alert(alertMessage);
  window.location.href = '/settings';
}

/**
 * 验证 token 并在缺少时重定向 (常用于页面加载时检查)
 * 
 * @param tokenType 需要检查的 token 类型
 * @param message 自定义提示消息
 * @returns boolean 是否存在有效 token
 */
export function validateToken(tokenType: TokenType = 'gitea', message?: string): boolean {
  const hasValidToken = checkToken(tokenType);
  
  if (!hasValidToken) {
    redirectToSettings(message, tokenType);
  }
  
  return hasValidToken;
}

/**
 * 包装需要 token 的操作
 * 如果没有 token，会提示并重定向到设置页面
 * 
 * @param action 需要执行的操作
 * @param tokenType 需要的 token 类型
 * @param message 自定义提示消息
 */
export function withToken<T extends (...args: any[]) => any>(
  action: T, 
  tokenType: TokenType = 'gitea',
  message?: string
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (validateToken(tokenType, message)) {
      return action(...args);
    }
    return undefined;
  };
}

export default {
  checkToken,
  redirectToSettings,
  validateToken,
  withToken
}; 