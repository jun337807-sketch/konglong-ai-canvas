export function createNodeTypes(components: {
  TextNode: any;
  ImageNode: any;
  VideoNode: any;
  AudioNode: any;
  ScriptNode: any;
  AIGenNode: any;
  ResultNode: any;
  AssetGroupNode: any;
  ReviewResultNode: any;
}) {
  return {
    textNode: components.TextNode,
    imageNode: components.ImageNode,
    videoNode: components.VideoNode,
    audioNode: components.AudioNode,
    scriptNode: components.ScriptNode,
    aiGenNode: components.AIGenNode,
    resultNode: components.ResultNode,
    assetGroupNode: components.AssetGroupNode,
    reviewResultNode: components.ReviewResultNode,
  };
}
