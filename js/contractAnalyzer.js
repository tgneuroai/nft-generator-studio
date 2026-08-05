/**
 * Analyzes Solidity source code extracted from uploaded ZIP archives
 */
export class ContractAnalyzer {
  constructor() {
    this.detectedOrder = [];
    this.traitMappings = {};
    this.metadataFormat = null;
  }

  /**
   * Scans extracted Solidity files for renderer and trait configurations
   * @param {Object} zipFiles - Hash map of files extracted by JSZip
   */
  async analyzeSolidityFiles(zipFiles) {
    let rendererCode = '';
    let traitsCode = '';

    for (const relativePath in zipFiles) {
      if (relativePath.endsWith('.sol')) {
        const content = await zipFiles[relativePath].async('string');
        if (relativePath.includes('Renderer') || content.includes('renderSvg')) {
          rendererCode += content + '\n';
        }
        if (relativePath.includes('Traits') || content.includes('traitSignature')) {
          traitsCode += content + '\n';
        }
      }
    }

    this.detectedOrder = this.extractLayerOrder(rendererCode);
    this.traitMappings = this.extractMappings(rendererCode + traitsCode);
    
    return {
      layerOrder: this.detectedOrder,
      traitMappings: this.traitMappings
    };
  }

  /**
   * Extracts execution flow of layer rendering from Solidity function calls
   */
  extractLayerOrder(code) {
    const order = [];
    // Match calls like _bodyForSuit, _svgHair, _renderMouth inside composite functions
    const regex = /(_svg\w+|_render\w+|_body\w+)/g;
    let match;
    const found = new Set();
    
    while ((match = regex.exec(code)) !== null) {
      let layerName = match[1]
        .replace(/^_(svg|render|pick)/, '')
        .replace(/For\w+$/, '');
      
      if (layerName && !found.has(layerName.toLowerCase())) {
        found.add(layerName.toLowerCase());
        order.push(layerName);
      }
    }

    return order.length > 0 ? order : [
      'Background', 'Body', 'Skin', 'Hair', 'Eyes', 'Mouth', 'Accessories', 'Badge'
    ];
  }

  /**
   * Extracts trait index-to-name maps from Solidity if statements / mappings
   */
  extractMappings(code) {
    const mappings = {};
    // Matches patterns like: if (idx == 0) return "Sky Blue";
    const pattern = /if\s*\(\w+\s*==\s*(\d+)\)\s*return\s*"([^"]+)";/g;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      const idx = parseInt(match[1], 10);
      const name = match[2];
      if (!mappings['default']) mappings['default'] = {};
      mappings['default'][idx] = name;
    }

    return mappings;
  }
}
