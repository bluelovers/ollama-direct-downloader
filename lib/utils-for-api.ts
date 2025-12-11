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
