const validChars = /^[a-zA-Z0-9\-_\.]+$/;

export const enum EnumOllamaManifestsResponseNodeMediaType {

  "docker_distribution_manifest_v2_json" = "application/vnd.docker.distribution.manifest.v2+json",

  "docker_container_image_v1_json" = "application/vnd.docker.container.image.v1+json",

  "model" = "application/vnd.ollama.image.model",

  "template" = "application/vnd.ollama.image.template",

  "license" = "application/vnd.ollama.image.license",

  "params" = "application/vnd.ollama.image.params",

}

export type IOllamaManifestsResponseNodeDigest = `sha256:${string}`;
export type IOllamaManifestsResponseNodeDigestFilename = `sha256-${string}`;

/**
 * @default 'library'
 */
export type IOllamaLibraryOrNamespace = string | 'library';

export interface IOllamaManifestsResponseNode<T extends EnumOllamaManifestsResponseNodeMediaType> {
  "mediaType": T,
  "digest": IOllamaManifestsResponseNodeDigest,
  "size": number
}

/**
 * @url https://registry.ollama.ai/v2/huihui_ai/qwen3-abliterated/manifests/latest
 */
export interface IOllamaManifestsResponse {
  "schemaVersion": 2,
  "mediaType": EnumOllamaManifestsResponseNodeMediaType.docker_distribution_manifest_v2_json,
  "config": IOllamaManifestsResponseNode<EnumOllamaManifestsResponseNodeMediaType.docker_container_image_v1_json>,
  "layers": [
    IOllamaManifestsResponseNode<EnumOllamaManifestsResponseNodeMediaType.model>,

    IOllamaManifestsResponseNode<EnumOllamaManifestsResponseNodeMediaType.template>,

    IOllamaManifestsResponseNode<EnumOllamaManifestsResponseNodeMediaType.license>,

    IOllamaManifestsResponseNode<EnumOllamaManifestsResponseNodeMediaType.params>,
  ]
}

export function getOllamaUrlBase(modelPathID: string) {
  return `https://registry.ollama.ai/v2/${modelPathID}/` as const
}

export function getOllamaBlobsUrlBase(modelPathID: string) {
  return `${getOllamaUrlBase(modelPathID)}blobs/` as const
}

/**
 * 
 * @param modelID 
 * @param digest 
 * @returns `https://registry.ollama.ai/v2/${string}/blobs/sha256:${string}`
 * 
 * @url https://registry.ollama.ai/v2/huihui_ai/qwen3-abliterated/blobs/sha256:b328f126e487d412563c86aa8793c5ddc1f516c6e76a3166d84ad54befc3f45d
 */
export function getOllamaBlobsUrl(modelPathID: string, digest: IOllamaManifestsResponseNodeDigest) {
  return `${getOllamaBlobsUrlBase(modelPathID)}${digest}` as const
}

/**
 * 
 * @param modelPathID 
 * @param tag 
 * @returns `https://registry.ollama.ai/v2/${string}/manifests/${string}`
 * 
 * @url https://registry.ollama.ai/v2/huihui_ai/qwen3-abliterated/manifests/latest
 */
export function getOllamaManifestsUrl(modelPathID: string, tag: string) {
  return `${getOllamaUrlBase(modelPathID)}manifests/${tag}` as const
}

export function convertDigestToFilename(digest: IOllamaManifestsResponseNodeDigest) {
  return digest.replace(":", "-") as IOllamaManifestsResponseNodeDigestFilename
}

/**
 * 
 * @param modelPathID 
 * @returns [namespace, modelName, ...rest]
 */
export function _getModelPathIDCore(modelPathID: string) {
  let namespace: IOllamaLibraryOrNamespace = 'library';
  let rest: string[];

  if (/[\\/]/.test(modelPathID)) {
    ([namespace, modelPathID, ...rest] = modelPathID.split(/[\\/]/));
  }

  return [namespace, modelPathID, ...rest] as const
}

/**
 * 
 * @param modelPathID 
 * @param sep 
 * @returns `${string}${'\\' | '/'}${string}`
 */
export function getModelPathID<T extends '\\' | '/' = '/'>(modelPathID: string, sep: T = '/' as T) {
  return _getModelPathIDCore(modelPathID).join(sep) as `${IOllamaLibraryOrNamespace}${T}${string}`
}

/**
 * 
 * @param modelPathID 
 * @returns `$OLLAMA_MODELS\\manifests\\registry.ollama.ai\\${IOllamaLibraryOrNamespace}\\${string}`
 */
export function getManifestFolderPath(modelPathID: string) {
  return `$OLLAMA_MODELS\\manifests\\registry.ollama.ai\\${getModelPathID(modelPathID, '\\')}` as const;
}

/**
 * 
 * @param modelPathID 
 * @returns `https://ollama.com/${IOllamaLibraryOrNamespace}/${string}`
 */
export function getOllamaModelPageUrl(modelPathID: string) {
  return `https://ollama.com/${getModelPathID(modelPathID, '/')}` as const;
}

/**
 * 
 * @param part 
 * @param name 
 * @param throwError 
 * @returns 
 */
export function _validatePart(part: string, name: string, throwError = false) {
  if (!part) {
    if (throwError) throw new SyntaxError(`${name} cannot be empty`)
    return false;
  } else if (!validChars.test(part)) {
    if (throwError) throw new SyntaxError(`${name} can only contain letters, numbers, _, -, and .`)
    return false;
  }
  return true;
}

/**
 * 驗證模型名稱和標籤
 * 
 * @param modelName 
 * @param tag 
 * @param throwError 
 */
export function _validateModelParts(modelName: string, tag: string, throwError = false) {
  const parts = _getModelPathIDCore(modelName);
  
  if (parts.length !== 1) {
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      if (throwError) throw new SyntaxError('User namespace must be in format "namespace/model"')
      return false;
    }
    return _validatePart(parts[0], 'Namespace', throwError) && _validatePart(parts[1], 'Model name', throwError);
  }
  
  return _validatePart(modelName, 'Model name', throwError) && _validatePart(tag, 'Tag', throwError);
}