"use client"

import { useEffect, useState } from 'react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModeToggle } from "@/components/mode-toggle"
import ResultsCard from '@/components/results-card'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'
import GitHubButton from 'react-github-btn'
import { 
  _getModelPathIDCore,
  _validateModelParts,
  getManifestFolderPath, 
  getOllamaManifestsUrl,
  getOllamaModelPageUrl,
} from '@/lib/utils-for-api'

export default function Home() {
  const searchParams = useSearchParams()
  const [textInput, setTextInput] = useState('')
  const [hasAutoSearched, setHasAutoSearched] = useState(false)
  const [url, setUrl] = useState<ReturnType<typeof getOllamaManifestsUrl> | ''>('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelName, setmodelName] = useState('')
  const [error, setError] = useState('')
  const [modelTag, setModelTag] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [originalError, setOriginalError] = useState('')

  const { theme } = useTheme()
  const [imgSrc, setImgSrc] = useState("/favicon_dark.png"); // default

  // 解析和驗證模型輸入
  function parseModelInput(input: string) {
    // 解析不同的輸入格式
    let modelTag = input
    
    if (input.startsWith('ollama pull ') || input.startsWith('ollama run ')) {
      const commandParts = input.split(/\s+/);
      modelTag = commandParts.slice(2).join(' ').trim();
      
      if (!modelTag) {
        throw new Error(`Model name is required after '${commandParts[0]} ${commandParts[1]}'`)
      }
    }
    
    // 分割獲取模型和標籤
    const modelSplit = modelTag.split(/\s*:\s*/);
    const modelName = modelSplit[0].trim();
    const tag = modelSplit.length === 2 ? modelSplit[1].trim() : 'latest';
    
    if (modelSplit.length > 2) {
      throw new Error('Use the format "model:tag", "model:latest" if unsure, or "ollama pull/run model[:tag]"')
    }
    
    return { modelName, tag, modelTag }
  }

  function validateModelParts(modelName: string, tag: string) {
    try {
      return _validateModelParts(modelName, tag, true);
    } catch (error) {
      toast.error((error as Error).message)
      
      setResult('');
      setError((error as Error).message);
      setOriginalError('');
    }
    
    return false;
  }

  useEffect(() => {
    if (theme === "light") {
      setImgSrc("/favicon.png");
    } else if (theme === "dark") {
      setImgSrc("/favicon_dark.png");
    }
  }, [theme]); // runs every time `theme` changes

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>, customInput?: string) => {
    e.preventDefault();
    
    const trimmedInput = (customInput || textInput).trim();

    if (!trimmedInput) {
      toast.error('Model name is required')
      return;
    }
    
    const { modelName, tag, modelTag } = parseModelInput(trimmedInput)
    
    // Check if this query is the same as the last query
    const lastQueryWasSuccessful = modelName === lastQuery && result && !error;
    if (lastQueryWasSuccessful) {
      toast.info('You have already searched for this model successfully')
      return;
    }
    
    const isRetryOfFailedQuery = modelName === lastQuery && error && !result;
    if (isRetryOfFailedQuery) {
      toast.warning('Retrying the same model that failed previously')
    }
    
    // Validate model name and tag
    if (!validateModelParts(modelName, tag)) {
      return;
    }

    // Clear results and set loading state
    setResult('');
    setError('');
    setOriginalError('');
    setLoading(true);
    setUrl('');
    setmodelName(modelName);
    setModelTag(modelName.includes('/') ? modelName : `${modelName}:latest`);

    // Build the manifest URL
    const basePath = modelName.includes('/') ? modelName : `library/${modelName}`;
    const url = getOllamaManifestsUrl(basePath, tag)
    setUrl(url);

    // Save the model name to upstash db (only if UPSTASH_REDIS_REST_URL is configured)
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL) {
      try {
        await fetch('/api/save-query', {
          method: 'POST',
          body: JSON.stringify({ query: textInput }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
      catch{
        // Silently fail if Redis is not available
      }
    }


    // Get the download links from proxy api
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      
      // Check if it's an error response from our proxy API
      if (responseData.error) {
        throw responseData
      }
      
      // Valid successful response
      setResult(responseText) // Store the raw response text
      setError('')
      setOriginalError('')

    } catch (error) {
      console.error('API Error:', error)
      
      // Handle both network errors and structured error responses
      let errorData: any
      let userMessage = 'Failed to fetch model data. Please try again later.'
      let errorDetails = ''
      
      if (error instanceof Error) {
        userMessage = error.message
        // Network or fetch errors won't have our structured format
      } else if (typeof error === 'object' && error.error) {
        // Structured error response from proxy API
        errorData = error
        userMessage = errorData.error
        errorDetails = errorData.originalMessage || ''
      }
      
      // Add retry context if this is a retry of a failed query
      if (isRetryOfFailedQuery) {
        userMessage = `Retry Attempt: ${userMessage}`
      }
      
      // Store both error message and details for display
      setError(userMessage)
      setOriginalError(errorDetails)
      toast.error(userMessage, {
        duration: 6000,
        style: {
          background: '#ef4444',
          color: '#ffffff',
          border: '1px solid #dc2626',
        }
      })
    } finally {
      // Record the query regardless of success or failure
      setLastQuery(modelName)
      setLoading(false)
    }
  }

    // Get model from URL parameter on component mount and trigger search if valid
  useEffect(() => {
    const modelParam = searchParams.get('model')
    if (modelParam && !hasAutoSearched) {
      const decodedParam = decodeURIComponent(modelParam).trim()

      if (decodedParam) {
        setTextInput(decodedParam)
        setHasAutoSearched(true)
        
        // Auto-trigger search with the decoded param directly
        const timer = setTimeout(() => {
          handleSearch({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>, decodedParam)
        }, 100)
        
        return () => clearTimeout(timer)
      }
    }
  }, [searchParams])

  // Increment views in upstash db (only if UPSTASH_REDIS_REST_URL is configured)
  useEffect(() => {
    // Only call page-load API when Redis is configured
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL) {
      fetch('/api/page-load', {
        method: 'POST',
        body: null,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }, []);

  const isSuccessful = !!result && !error;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className='flex items-center gap-4'>

            <Link href={'/'}>
              <img src={imgSrc} alt="Ollama Logo" width="25" height="25" />
            </Link>

            <h1 className="text-2xl font-bold text-foreground">
              <Link href={'/'}>Ollama Direct Downloader</Link>
            </h1>

          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <span className="mt-1">
              <GitHubButton href="https://github.com/Gholamrezadar/ollama-direct-downloader" data-color-scheme="no-preference: light; light: light; dark: dark;" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star Gholamrezadar/ollama-direct-downloader on GitHub">Star</GitHubButton>
            </span>

            {/* Old Github Logo link */}
            {/*<a
              href="https://github.com/Gholamrezadar/ollama-direct-downloader"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <Github className="h-5 w-5" />
              </Button>
            </a>
            */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter a model tag e.g. gemma2:2b"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Fetching...' : 'Extract'}
              </Button>
            </div>
          </form>

          {/* Model Link */}
          {modelTag && (
            <div className='p-3 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600'>
              <p className='text-sm'>
                <span className='text-slate-700 dark:text-slate-300'>Model Page:</span> 
                <a href={getOllamaModelPageUrl(modelTag)} target='_blank' rel='noopener noreferrer' className='text-cyan-500 underline ml-2'>
                  {getOllamaModelPageUrl(modelTag)}
                </a>
              </p>
            </div>
          )}

          {!loading && !isSuccessful &&
            <div className='text-slate-600 text-sm w-full flex justify-center items-center'>
              Enter the name of the model you want to download and press enter
            </div>
          }
          {/* Show spinner while loading */}
          {loading && (
            <div className='flex justify-center items-center'>
              <div
                className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status">
                <span
                  className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                >Loading...</span>
              </div>
            </div>

          )}

          {/* Show error message */}
          {!loading && !isSuccessful && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-red-500">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-red-800 font-medium mb-2">Error Loading Model</h3>
                  <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
                  {originalError && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
                      <h4 className="text-red-800 font-medium text-sm mb-1">Original Error Details:</h4>
                      <p className="text-red-600 text-sm font-mono">{originalError}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Show result after loading */}
          {!loading && isSuccessful && (
            <>
              <div className='text-slate-600 text-sm w-full flex justify-center items-center'>
                Please give <a href='https://github.com/Gholamrezadar/ollama-direct-downloader' className='text-cyan-500 underline mx-1'> this repo </a> a star if it helped you &lt;3
              </div>

              <ResultsCard model_name={modelName} result={result} url={url} />

              <div className='text-slate-600 text-sm'>
                Help:
                <br />
                Download the Manifest file and place it in a folder like <code className='dark:bg-slate-900 dark:text-slate-600 bg-blue-200 text-slate-600'>{getManifestFolderPath(modelTag)}</code>
                <br />
                <br />
                Download the blobs and place them in a folder like <code className='dark:bg-slate-900 dark:text-slate-600 bg-blue-200'>$OLLAMA_MODELS\blobs</code>
                <br />
                <br />
                - The server might change the name of each file, copy the names from the box above and rename the files accordingly
                <br />
                <br />
                - To make sure about the manifest and blobs directories, download a small model using ollama cli directly as these directories can change and get weird!
                <br />
                <br />
                Made by <a href='https://github.com/Gholamrezadar/' className='text-cyan-500 underline mx-1'>Gholamreza Dar</a>
              </div>
            </>
          )}
        </div>
      </main>
      <Toaster richColors />
    </div>
  )
}
