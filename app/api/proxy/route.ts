// app/api/proxy/route.ts
import { getOllamaManifestsUrl } from '@/lib/utils-for-api';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 統一的錯誤回應格式
interface ErrorResponse {
  error: string;
  status: number;
  timestamp: string;
  originalMessage?: string;
}

// 創建統一的錯誤回應
function createErrorResponse(error: string, status: number, originalMessage?: string): NextResponse {
  const response: ErrorResponse = {
    error,
    status,
    timestamp: new Date().toISOString(),
    ...(originalMessage && { originalMessage })
  };
  
  return NextResponse.json(response, { status });
}

// 解析回應內容為 JSON
async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response format: Expected JSON but received non-JSON data');
  }
}

// 提取錯誤詳情
function extractErrorDetails(jsonResponse: any, rawText: string): string {
  // 處理 manifests API 錯誤格式: {"errors":[{"code":"MANIFEST_UNKNOWN","message":"manifest unknown"}]}
  if (jsonResponse.errors && Array.isArray(jsonResponse.errors) && jsonResponse.errors.length > 0) {
    const error = jsonResponse.errors[0];
    if (error.code && error.message) {
      return `${error.code}: ${error.message}`;
    }
    if (error.message) return error.message;
    if (error.code) return `Error code: ${error.code}`;
  }
  
  // 標準錯誤格式
  if (jsonResponse.error) return jsonResponse.error;
  if (jsonResponse.message) return jsonResponse.message;
  
  // 回退到原始文本（如果不過長）
  return rawText.length < 200 ? rawText : '';
}

// 根據錯誤類型提供用戶友好的錯誤訊息
function getFriendlyErrorMessage(errorStr: string): string {
  if (errorStr.includes('MANIFEST_UNKNOWN')) {
    return 'Model not found: The specified model or tag does not exist in registry';
  }
  if (errorStr.includes('404') || errorStr.includes('Not Found')) {
    return 'Model not found: The specified model or tag does not exist';
  }
  if (errorStr.includes('500')) {
    return 'Server error: The Ollama registry is experiencing issues';
  }
  if (errorStr.includes('429') || errorStr.includes('Too Many Requests')) {
    return 'Too many requests: Please wait and try again later';
  }
  if (errorStr.includes('Failed to fetch') || errorStr.includes('NetworkError')) {
    return 'Network error: Unable to connect to the server. Please check your connection and try again.';
  }
  if (errorStr.includes('timeout')) {
    return 'Request timeout: The server took too long to respond. Please try again later.';
  }
  if (errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED')) {
    return 'Connection error: Unable to reach the server. The server may be down or experiencing issues.';
  }
  if (errorStr.includes('Invalid response format')) {
    return 'Invalid response format: Expected JSON but received non-JSON data';
  }
  
  // 使用原始錯誤訊息（如果不過長）
  return errorStr.length < 100 ? errorStr : 'An error occurred while fetching data from the external API';
}

export interface IMyApiProxyRequest {
  url: ReturnType<typeof getOllamaManifestsUrl>;
}

export async function POST(request: Request) {
  try {
    // 解析請求主體
    // url is https://registry.ollama.ai/v2/huihui_ai/qwen3-abliterated2/manifests/latest
    const { url } = await request.json() as IMyApiProxyRequest;
    
    // 驗證 URL
    if (!url || typeof url !== 'string') {
      return createErrorResponse('URL is required and must be a string', 400);
    }

    console.log('Fetching URL:', url);

    // 獲取外部 API 數據
    const response = await fetch(url);
    console.log('Response status:', response.status, response.statusText);

    // 檢查回應是否正常
    if (!response.ok) {
      // 解析錯誤詳情
      let errorDetails = '';
      try {
        const text = await response.text();
        const jsonResponse = JSON.parse(text);
        errorDetails = extractErrorDetails(jsonResponse, text);
      } catch {
        // 如果無法解析，使用狀態文本
        errorDetails = response.statusText;
      }

      const errorMessage = errorDetails 
        ? `Failed to fetch data: ${response.statusText} - ${errorDetails}`
        : `Failed to fetch data: ${response.statusText}`;

      return createErrorResponse(errorMessage, response.status, errorDetails);
    }

    // 解析成功的 JSON 回應
    try {
      const data = await parseJsonResponse(response);
      return NextResponse.json(data);
    } catch (error) {
      console.error('Response is not valid JSON:', error);
      return createErrorResponse(
        'Invalid response format: Expected JSON but received non-JSON data',
        500,
        error instanceof Error ? error.message : 'Unknown parsing error'
      );
    }

  } catch (error) {
    console.error('Error fetching external API:', error);
    
    if (error instanceof Error) {
      const friendlyMessage = getFriendlyErrorMessage(error.message);
      const status = (error as any).statusCode || 500;
      return createErrorResponse(friendlyMessage, status, error.message);
    }
    
    return createErrorResponse(
      'An unexpected error occurred while fetching data from the external API',
      500
    );
  }
}