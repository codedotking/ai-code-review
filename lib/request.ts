import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface RequestOptions extends AxiosRequestConfig {
  useToken?: boolean;      // 是否使用 token，默认 true
  maxRetries?: number;     // 最大重试次数
  retryDelay?: number;     // 重试延迟时间(ms)
  tokenValue?: string;     // 手动传入 token 值
  tokenType?: 'gitea' | 'openai'; // token 类型
}

interface ResponseData<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// 获取 Token 函数
const getToken = (type: 'gitea' | 'openai' = 'gitea'): string => {
  if (typeof window === 'undefined') {
    // 服务端渲染环境
    return type === 'gitea' 
      ? (process.env.GITEA_TOKEN || '') 
      : (process.env.OPENAI_API_KEY || '');
  }
  
  // 客户端环境
  return type === 'gitea'
    ? (localStorage.getItem('giteaToken') || '')
    : (localStorage.getItem('openaiKey') || '');
};

// 检查是否有 token
export const hasToken = (type: 'gitea' | 'openai' = 'gitea'): boolean => {
  return !!getToken(type);
};

// 创建 axios 实例
const instance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 每次请求前检查是否需要附加 token
    const useToken = config.headers['X-Use-Token'] !== 'false';
    if (useToken) {
      // 优先使用传入的 token
      let token = config.headers['X-Token-Value'] as string;
      const tokenType = (config.headers['X-Token-Type'] as string) || 'gitea';
      
      // 如果没有传入 token，则从本地获取
      if (!token) {
        token = getToken(tokenType as 'gitea' | 'openai');
      }
      
      if (token) {
        if (tokenType === 'gitea') {
          config.headers['Authorization'] = `token ${token}`;
        } else if (tokenType === 'openai') {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
    
    // 移除临时请求头标记
    delete config.headers['X-Use-Token'];
    delete config.headers['X-Token-Type'];
    delete config.headers['X-Token-Value'];
    
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RequestOptions & { _retryCount?: number };
    
    // 初始化重试计数
    if (config._retryCount === undefined) {
      config._retryCount = 0;
    }
    
    // 检查是否需要重试
    if (config._retryCount < (config.maxRetries || 0)) {
      config._retryCount += 1;
      
      // 延迟重试
      await new Promise(resolve => 
        setTimeout(resolve, config.retryDelay || 1000)
      );
      
      // 重试请求
      return instance(config);
    }
    
    // 超过重试次数，返回错误
    return Promise.reject(error);
  }
);

// 通用请求函数
export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<ResponseData<T>> {
  try {
    // 设置令牌类型和是否使用令牌
    const headers: Record<string, any> = { ...options.headers || {} };
    if (options.useToken !== false) {
      headers['X-Use-Token'] = 'true';
      headers['X-Token-Type'] = options.tokenType || 'gitea'; // 默认使用 gitea token
      
      // 如果传入了 token 值，使用传入的值
      if (options.tokenValue) {
        headers['X-Token-Value'] = options.tokenValue;
      }
    } else {
      headers['X-Use-Token'] = 'false';
    }
    
    const response: AxiosResponse<T> = await instance({
      url,
      ...options,
      headers,
    });
    
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as Record<string, any>;
      return {
        success: false,
        error: responseData?.message || axiosError.message,
        status: axiosError.response?.status,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// HTTP 方法快捷函数
export function get<T = any>(url: string, options: RequestOptions = {}): Promise<ResponseData<T>> {
  return request<T>(url, { ...options, method: 'GET' });
}

export function post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ResponseData<T>> {
  return request<T>(url, { ...options, method: 'POST', data });
}

export function put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ResponseData<T>> {
  return request<T>(url, { ...options, method: 'PUT', data });
}

export function patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ResponseData<T>> {
  return request<T>(url, { ...options, method: 'PATCH', data });
}

export function del<T = any>(url: string, options: RequestOptions = {}): Promise<ResponseData<T>> {
  return request<T>(url, { ...options, method: 'DELETE' });
}

export default {
  request,
  get,
  post,
  put,
  patch,
  delete: del,
  hasToken,
}; 